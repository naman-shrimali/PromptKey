import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

process.env.ENCRYPTION_KEY = "test-key-material-for-m4-suite";

import { extractVariables, fillVariables } from "@/lib/variables";
import { createE2ePromptRecord } from "@/lib/create-prompt";
import { resolveScan, logScanEvent } from "@/lib/scan";
import { getPromptAnalytics } from "@/lib/analytics";
import { Prompt, ScanEvent } from "@/lib/models";

let mongod: MongoMemoryServer;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongod?.stop();
});

describe("prompt variables (SPEC §5 M4)", () => {
    it("extracts unique names in order of appearance", () => {
        expect(
            extractVariables("Hi {{ name }}, welcome to {{company}}! Bye {{name}}.")
        ).toEqual(["name", "company"]);
    });

    it("ignores malformed and absurd placeholders", () => {
        expect(extractVariables("no vars here")).toEqual([]);
        expect(extractVariables("{{}} {{ }} {single} {{multi\nline}}")).toEqual([]);
        expect(extractVariables(`{{${"x".repeat(80)}}}`)).toEqual([]); // > 50 chars
    });

    it("fills provided values and preserves untouched placeholders + whitespace", () => {
        const template = "Dear {{name}},\n\t{{greeting}} from {{name}}!";
        expect(fillVariables(template, { name: "Ada" })).toBe(
            "Dear Ada,\n\t{{greeting}} from Ada!"
        );
    });
});

describe("E2E prompts (SPEC §5 M4)", () => {
    const mkCipher = () => ({
        // structurally valid b64url blobs — server treats them as opaque
        ciphertext: Buffer.from("x".repeat(64)).toString("base64url"),
        iv: Buffer.from("123456789012").toString("base64url"),
    });

    it("stores ciphertext untouched with no plaintext-derived metadata", async () => {
        const { ciphertext, iv } = mkCipher();
        const result = await createE2ePromptRecord({
            ciphertext,
            iv,
            charCount: 42,
            userId: null,
            clientIp: "9.9.9.9",
        });
        expect("slug" in result).toBe(true);
        if (!("slug" in result)) return;

        const doc = await Prompt.findOne({ shortSlug: result.slug });
        expect(doc!.e2e).toBe(true);
        expect(doc!.encryptedContent).toBe(ciphertext); // byte-identical passthrough
        expect(doc!.iv).toBe(iv);
        expect(doc!.authTag).toBeNull();
        expect(doc!.title).not.toMatch(/x{10}/); // never derived from content
        expect(doc!.charCount).toBe(42);
    });

    it("resolves scans without attempting server-side decryption", async () => {
        const { ciphertext, iv } = mkCipher();
        const created = await createE2ePromptRecord({
            ciphertext,
            iv,
            userId: null,
            clientIp: "9.9.9.8",
        });
        if (!("slug" in created)) throw new Error("create failed");

        const res = await resolveScan(created.slug);
        expect(res.status).toBe("ok");
        if (res.status !== "ok") return;
        expect(res.e2e).toBe(true);
        expect(res.content).toBe(""); // plaintext never exists server-side
    });

    it("rejects malformed ciphertext", async () => {
        const result = await createE2ePromptRecord({
            ciphertext: "not/valid+b64url!",
            iv: "short",
            userId: null,
            clientIp: "9.9.9.7",
        });
        expect("error" in result).toBe(true);
    });
});

describe("scan analytics (SPEC §5 M4)", () => {
    it("logs coarse events and aggregates daily/device/referrer buckets", async () => {
        const promptId = new mongoose.Types.ObjectId();

        await logScanEvent(promptId, "Mozilla/5.0 (iPhone; like Mac OS X)", "https://chat.example.com/thread/42?secret=1");
        await logScanEvent(promptId, "Mozilla/5.0 (Macintosh; Intel Mac OS X)", null);
        await logScanEvent(promptId, "Mozilla/5.0 (Linux; Android 14)", "https://chat.example.com/other");

        const events = await ScanEvent.find({ promptId });
        expect(events).toHaveLength(3);
        // privacy: referrer is host-only, never path or query
        for (const e of events) {
            expect(e.referrer).not.toMatch(/thread|secret|\?|\//);
        }

        const analytics = await getPromptAnalytics(String(promptId));
        expect(analytics.total30d).toBe(3);
        expect(analytics.devices).toEqual({ mobile: 2, desktop: 1 });
        expect(analytics.referrers).toEqual([{ host: "chat.example.com", count: 2 }]);
        expect(analytics.daily).toHaveLength(14);
        expect(analytics.daily[13].count).toBe(3); // all logged today
    });

    it("never throws on garbage input (analytics must not break pages)", async () => {
        await expect(
            logScanEvent(new mongoose.Types.ObjectId(), null, "::not a url::")
        ).resolves.toBeUndefined();
    });
});
