import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import crypto from "crypto";

process.env.ENCRYPTION_KEY = "test-key-material-for-m5-suite";
process.env.RAZORPAY_KEY_SECRET = "test_key_secret";
process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret";

import { CatalogPrompt, Purchase, Subscription } from "@/lib/models";
import { encrypt } from "@/lib/encryption";
import {
    hasAccess,
    hasAccessToPrompt,
    hasActiveSubscription,
    isFreePrompt,
    serializeCatalogPrompt,
} from "@/lib/market-access";
import { processWebhookEvent } from "@/lib/webhook-handlers";
import { verifyCheckoutSignature, verifyWebhookSignature } from "@/lib/razorpay";

let mongod: MongoMemoryServer;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Purchase.init(); // partial unique index
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongod?.stop();
});

const DAY = 24 * 60 * 60 * 1000;
const oid = () => new mongoose.Types.ObjectId();

async function makeCatalogPrompt(secret = "the paid prompt content") {
    const enc = encrypt(secret);
    return CatalogPrompt.create({
        slug: `p-${Math.random().toString(36).slice(2, 8)}`,
        title: "Test prompt",
        category: "coding",
        previewText: "free teaser",
        isPublished: true,
        variants: [
            { model: "claude", modelLabel: "Claude", content: enc.content, iv: enc.iv, authTag: enc.authTag },
        ],
    });
}

describe("marketplace access (SPEC §5 M5)", () => {
    it("denies by default, grants via paid purchase, ignores unpaid orders", async () => {
        const userId = String(oid());
        const prompt = await makeCatalogPrompt();
        expect(await hasAccess(userId, String(prompt._id))).toBe(false);

        await Purchase.create({
            userId,
            catalogPromptId: prompt._id,
            razorpayOrderId: `order_${userId.slice(-6)}a`,
            amountINR: 4900,
            status: "created",
        });
        expect(await hasAccess(userId, String(prompt._id))).toBe(false);

        await Purchase.updateOne({ userId }, { $set: { status: "paid" } });
        expect(await hasAccess(userId, String(prompt._id))).toBe(true);
    });

    it("grants whole catalog on active subscription, honors 3-day past_due grace", async () => {
        const userId = String(oid());
        const prompt = await makeCatalogPrompt();

        const sub = await Subscription.create({
            userId,
            razorpaySubscriptionId: `sub_${userId.slice(-6)}`,
            plan: "monthly",
            status: "active",
            currentPeriodEnd: new Date(Date.now() + 7 * DAY),
        });
        expect(await hasAccess(userId, String(prompt._id))).toBe(true);

        // period ended yesterday, payment stuck → inside 3-day grace
        await Subscription.updateOne(
            { _id: sub._id },
            { $set: { status: "past_due", currentPeriodEnd: new Date(Date.now() - 1 * DAY) } }
        );
        expect(await hasActiveSubscription(userId)).toBe(true);

        // beyond the grace window → no access
        await Subscription.updateOne(
            { _id: sub._id },
            { $set: { currentPeriodEnd: new Date(Date.now() - 5 * DAY) } }
        );
        expect(await hasActiveSubscription(userId)).toBe(false);
    });

    it("sub lapse revokes catalog access but purchased prompts stay (acceptance)", async () => {
        const userId = String(oid());
        const bought = await makeCatalogPrompt();
        const other = await makeCatalogPrompt();

        await Purchase.create({
            userId,
            catalogPromptId: bought._id,
            razorpayOrderId: `order_${userId.slice(-6)}b`,
            amountINR: 4900,
            status: "paid",
        });
        await Subscription.create({
            userId,
            razorpaySubscriptionId: `sub_${userId.slice(-6)}x`,
            plan: "weekly",
            status: "active",
            currentPeriodEnd: new Date(Date.now() + DAY),
        });

        expect(await hasAccess(userId, String(other._id))).toBe(true);

        await Subscription.updateOne(
            { razorpaySubscriptionId: `sub_${userId.slice(-6)}x` },
            { $set: { status: "cancelled" } }
        );
        expect(await hasAccess(userId, String(other._id))).toBe(false); // catalog gone
        expect(await hasAccess(userId, String(bought._id))).toBe(true); // purchase survives
    });
});

describe("free prompts (priceINR: 0)", () => {
    async function makeFreePrompt(secret = "the free prompt content") {
        const enc = encrypt(secret);
        return CatalogPrompt.create({
            slug: `free-${Math.random().toString(36).slice(2, 8)}`,
            title: "Free prompt",
            category: "coding",
            previewText: "teaser",
            priceINR: 0,
            isPublished: true,
            variants: [
                {
                    model: "generic",
                    modelLabel: "Any model",
                    content: enc.content,
                    iv: enc.iv,
                    authTag: enc.authTag,
                },
            ],
        });
    }

    it("distinguishes free from default-priced and explicitly-priced", async () => {
        expect(isFreePrompt({ priceINR: 0 })).toBe(true);
        expect(isFreePrompt({ priceINR: 4900 })).toBe(false);
        expect(isFreePrompt({ priceINR: null })).toBe(false); // null → default price
        expect(isFreePrompt({})).toBe(false);
    });

    it("grants access to everyone, including signed-out visitors", async () => {
        const free = await makeFreePrompt();
        expect(await hasAccessToPrompt(null, free)).toBe(true);
        expect(await hasAccessToPrompt(String(oid()), free)).toBe(true);
    });

    it("still gates paid prompts for the same anonymous caller", async () => {
        const paid = await makeCatalogPrompt();
        expect(await hasAccessToPrompt(null, paid)).toBe(false);
        expect(await hasAccessToPrompt(String(oid()), paid)).toBe(false);
    });

    it("serializes unlocked so anonymous readers get the content", async () => {
        const secret = "FREE-CONTENT-MARKER";
        const free = await makeFreePrompt(secret);
        const access = await hasAccessToPrompt(null, free);
        const payload = serializeCatalogPrompt(free, access);

        expect(payload.locked).toBe(false);
        expect(payload.isFree).toBe(true);
        if (!payload.locked) {
            expect(payload.variants[0].content).toBe(secret);
        }
    });
});

describe("paywall serialization (SPEC §5 M5 acceptance)", () => {
    it("locked payloads contain no variant content — plaintext or ciphertext", async () => {
        const secret = "SUPER-SECRET-PAID-CONTENT-XYZ";
        const prompt = await makeCatalogPrompt(secret);

        const locked = JSON.stringify(serializeCatalogPrompt(prompt, false));
        expect(locked).not.toContain(secret);
        expect(locked).not.toContain(prompt.variants[0].content); // not even ciphertext
        expect(locked).not.toContain("iv");
        expect(JSON.parse(locked).locked).toBe(true);
        expect(JSON.parse(locked).models).toEqual([{ model: "claude", modelLabel: "Claude" }]);

        const unlocked = serializeCatalogPrompt(prompt, true);
        expect(unlocked.locked).toBe(false);
        if (!unlocked.locked) {
            expect(unlocked.variants[0].content).toBe(secret);
        }
    });
});

describe("webhooks (SPEC §5 M5)", () => {
    it("payment.captured marks the purchase paid; duplicate delivery is a no-op", async () => {
        const userId = String(oid());
        const prompt = await makeCatalogPrompt();
        await Purchase.create({
            userId,
            catalogPromptId: prompt._id,
            razorpayOrderId: "order_webhook_1",
            amountINR: 4900,
            status: "created",
        });

        const event = {
            id: "evt_1",
            event: "payment.captured",
            payload: { payment: { entity: { id: "pay_1", order_id: "order_webhook_1" } } },
        };

        const first = await processWebhookEvent(event);
        expect(first).toEqual({ duplicate: false, handled: true });
        expect((await Purchase.findOne({ razorpayOrderId: "order_webhook_1" }))!.status).toBe("paid");

        // duplicate delivery (same event id) — acknowledged, nothing re-processed
        const second = await processWebhookEvent(event);
        expect(second.duplicate).toBe(true);

        // a late payment.failed for the same order must not downgrade paid
        await processWebhookEvent({
            id: "evt_2",
            event: "payment.failed",
            payload: { payment: { entity: { id: "pay_1", order_id: "order_webhook_1" } } },
        });
        expect((await Purchase.findOne({ razorpayOrderId: "order_webhook_1" }))!.status).toBe("paid");
    });

    it("drives the subscription lifecycle from events", async () => {
        const userId = String(oid());
        await Subscription.create({
            userId,
            razorpaySubscriptionId: "sub_hook_1",
            plan: "monthly",
            status: "created",
        });
        const entity = (over: object) => ({
            payload: { subscription: { entity: { id: "sub_hook_1", ...over } } },
        });
        const periodEnd = Math.floor((Date.now() + 30 * DAY) / 1000);

        await processWebhookEvent({ id: "evt_s1", event: "subscription.activated", ...entity({ current_end: periodEnd }) });
        let sub = await Subscription.findOne({ razorpaySubscriptionId: "sub_hook_1" });
        expect(sub!.status).toBe("active");
        expect(sub!.currentPeriodEnd!.getTime()).toBe(periodEnd * 1000);
        expect(await hasActiveSubscription(userId)).toBe(true);

        await processWebhookEvent({ id: "evt_s2", event: "subscription.halted", ...entity({}) });
        sub = await Subscription.findOne({ razorpaySubscriptionId: "sub_hook_1" });
        expect(sub!.status).toBe("past_due");

        await processWebhookEvent({ id: "evt_s3", event: "subscription.cancelled", ...entity({}) });
        sub = await Subscription.findOne({ razorpaySubscriptionId: "sub_hook_1" });
        expect(sub!.status).toBe("cancelled");
        expect(await hasActiveSubscription(userId)).toBe(false);
    });
});

describe("signature verification (SPEC §5 M5)", () => {
    it("accepts a correct checkout signature and rejects tampering", () => {
        const signature = crypto
            .createHmac("sha256", "test_key_secret")
            .update("order_9|pay_9")
            .digest("hex");
        expect(verifyCheckoutSignature({ orderId: "order_9", paymentId: "pay_9", signature })).toBe(true);
        expect(verifyCheckoutSignature({ orderId: "order_9", paymentId: "pay_X", signature })).toBe(false);
        expect(
            verifyCheckoutSignature({ orderId: "order_9", paymentId: "pay_9", signature: "deadbeef" })
        ).toBe(false);
    });

    it("verifies webhook bodies against the webhook secret", () => {
        const body = JSON.stringify({ event: "payment.captured" });
        const signature = crypto.createHmac("sha256", "test_webhook_secret").update(body).digest("hex");
        expect(verifyWebhookSignature(body, signature)).toBe(true);
        expect(verifyWebhookSignature(body + " ", signature)).toBe(false);
        expect(verifyWebhookSignature(body, null)).toBe(false);
    });
});
