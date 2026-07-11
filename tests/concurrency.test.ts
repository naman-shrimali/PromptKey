import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

process.env.ENCRYPTION_KEY = "test-key-material-for-concurrency-suite";

import { Prompt } from "@/lib/models";
import { encrypt } from "@/lib/encryption";
import { claimOneTimeView, resolveScan } from "@/lib/scan";
import { consumeRateLimit } from "@/lib/rate-limit";

let mongod: MongoMemoryServer;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Prompt.init(); // build indexes so unique constraints are live
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongod?.stop();
});

async function createPrompt(overrides: Record<string, unknown> = {}) {
    const enc = encrypt("the secret text");
    return Prompt.create({
        shortSlug: Math.random().toString(36).slice(2, 10),
        encryptedContent: enc.content,
        iv: enc.iv,
        authTag: enc.authTag,
        title: "the secret text",
        charCount: 15,
        isGuest: true,
        ...overrides,
    });
}

describe("one-time view (SPEC M0 acceptance: concurrent-scan test)", () => {
    it("lets exactly one of many simultaneous scans through", async () => {
        const prompt = await createPrompt({ isOneTimeView: true });

        const attempts = await Promise.all(
            Array.from({ length: 20 }, () => claimOneTimeView(prompt.shortSlug))
        );

        const winners = attempts.filter(Boolean);
        expect(winners).toHaveLength(1);

        const after = await Prompt.findById(prompt._id);
        expect(after!.scanCount).toBe(1);
    });

    it("resolves to gone after the single view is consumed", async () => {
        const prompt = await createPrompt({ isOneTimeView: true });

        const first = await resolveScan(prompt.shortSlug);
        expect(first.status).toBe("ok");
        if (first.status === "ok") {
            expect(first.content).toBe("the secret text");
        }

        const second = await resolveScan(prompt.shortSlug);
        expect(second.status).toBe("gone");
    });

    it("does not consume a one-time view for bot/prefetch requests", async () => {
        const prompt = await createPrompt({ isOneTimeView: true });

        const bot = await resolveScan(prompt.shortSlug, { consumeOneTime: false });
        expect(bot.status).toBe("gone");

        const human = await resolveScan(prompt.shortSlug);
        expect(human.status).toBe("ok");
    });
});

describe("scan resolution", () => {
    it("returns not_found for unknown slugs", async () => {
        expect((await resolveScan("nope1234")).status).toBe("not_found");
    });

    it("treats soft-deleted prompts as not_found", async () => {
        const prompt = await createPrompt({ deletedAt: new Date() });
        expect((await resolveScan(prompt.shortSlug)).status).toBe("not_found");
    });

    it("treats past expiresAt as gone even before TTL deletion runs", async () => {
        const prompt = await createPrompt({ expiresAt: new Date(Date.now() - 1000) });
        expect((await resolveScan(prompt.shortSlug)).status).toBe("gone");
    });

    it("treats un-migrated legacy (no authTag) records as gone", async () => {
        const prompt = await createPrompt({ authTag: undefined });
        await Prompt.updateOne({ _id: prompt._id }, { $unset: { authTag: "" } });
        expect((await resolveScan(prompt.shortSlug)).status).toBe("gone");
    });
});

describe("rate limiter (SPEC §2: single atomic findOneAndUpdate)", () => {
    it("never lets concurrent requests exceed the limit", async () => {
        const limit = 5;
        const results = await Promise.all(
            Array.from({ length: 20 }, () =>
                consumeRateLimit("ip:1.2.3.4", "generate", limit, 60_000)
            )
        );
        expect(results.filter((r) => r.allowed)).toHaveLength(limit);
    });

    it("resets the window after it expires", async () => {
        const shortWindow = 50;
        await consumeRateLimit("ip:5.6.7.8", "generate", 1, shortWindow);
        const blocked = await consumeRateLimit("ip:5.6.7.8", "generate", 1, shortWindow);
        expect(blocked.allowed).toBe(false);

        await new Promise((resolve) => setTimeout(resolve, shortWindow + 20));
        const fresh = await consumeRateLimit("ip:5.6.7.8", "generate", 1, shortWindow);
        expect(fresh.allowed).toBe(true);
    });
});
