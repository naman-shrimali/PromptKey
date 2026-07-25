import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

process.env.ENCRYPTION_KEY = "test-key-material-for-m2-suite";

import { Prompt } from "@/lib/models";
import { encrypt, decrypt, sha256Hex } from "@/lib/encryption";
import { claimPrompts } from "@/lib/claim";
import { buildContentUpdate, escapeRegex, MAX_VERSIONS } from "@/lib/living-qr";

let mongod: MongoMemoryServer;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongod?.stop();
});

async function createGuestPrompt(text: string, claimToken: string | null = "tok") {
    const enc = encrypt(text);
    return Prompt.create({
        shortSlug: Math.random().toString(36).slice(2, 10),
        encryptedContent: enc.content,
        iv: enc.iv,
        authTag: enc.authTag,
        contentHash: sha256Hex(text),
        title: text.slice(0, 60),
        charCount: [...text].length,
        isGuest: true,
        claimToken,
    });
}

describe("guest → account claim (SPEC §5 M2)", () => {
    const userId = new mongoose.Types.ObjectId().toString();

    it("claims prompts with a valid (slug, token) pair", async () => {
        const a = await createGuestPrompt("first", "tok-a");
        const b = await createGuestPrompt("second", "tok-b");

        const claimed = await claimPrompts(userId, [
            { slug: a.shortSlug, claimToken: "tok-a" },
            { slug: b.shortSlug, claimToken: "tok-b" },
        ]);
        expect(claimed).toBe(2);

        const after = await Prompt.findById(a._id);
        expect(String(after!.ownerUserId)).toBe(userId);
        expect(after!.isGuest).toBe(false);
        expect(after!.claimToken).toBeNull();
    });

    it("rejects a wrong token and double claims", async () => {
        const p = await createGuestPrompt("third", "real-token");

        expect(await claimPrompts(userId, [{ slug: p.shortSlug, claimToken: "forged" }])).toBe(0);
        expect(await claimPrompts(userId, [{ slug: p.shortSlug, claimToken: "real-token" }])).toBe(1);
        // token consumed — a second claim (e.g. another account) gets nothing
        expect(
            await claimPrompts(new mongoose.Types.ObjectId().toString(), [
                { slug: p.shortSlug, claimToken: "real-token" },
            ])
        ).toBe(0);
    });
});

describe("living QR edits (SPEC §5 M2)", () => {
    it("pushes the previous ciphertext into versions and keeps it decryptable", async () => {
        const p = await createGuestPrompt("version one");
        const update = buildContentUpdate(p, "version two");

        expect(update.versions).toHaveLength(1);
        const old = update.versions[0];
        expect(decrypt(old.iv, old.encryptedContent, old.authTag!)).toBe("version one");
        expect(decrypt(update.iv, update.encryptedContent, update.authTag)).toBe("version two");
        expect(update.title).toBe("version two");
        expect(update.charCount).toBe(11);
        expect(update.contentHash).toBe(sha256Hex("version two"));
    });

    it(`caps history at ${MAX_VERSIONS} versions`, async () => {
        const p = await createGuestPrompt("v0");
        let doc = p.toObject();
        for (let i = 1; i <= MAX_VERSIONS + 3; i++) {
            doc = { ...doc, ...buildContentUpdate(doc, `v${i}`) };
        }
        expect(doc.versions).toHaveLength(MAX_VERSIONS);
        // oldest retained version is the one MAX_VERSIONS edits ago
        const oldest = doc.versions[0];
        expect(decrypt(oldest.iv, oldest.encryptedContent, oldest.authTag!)).toBe(
            `v${3}` // v13 is current; history holds v3..v12
        );
    });

    it("slug never changes across edits", async () => {
        const p = await createGuestPrompt("original");
        const slug = p.shortSlug;
        await Prompt.updateOne({ _id: p._id }, { $set: buildContentUpdate(p, "edited") });
        const after = await Prompt.findById(p._id);
        expect(after!.shortSlug).toBe(slug);
        expect(decrypt(after!.iv, after!.encryptedContent, after!.authTag)).toBe("edited");
    });
});

describe("escapeRegex", () => {
    it("neutralizes regex metacharacters in search input", () => {
        const hostile = "a.*+?^${}()|[]\\b";
        const re = new RegExp(escapeRegex(hostile));
        expect(re.test(hostile)).toBe(true);
        expect(re.test("aXb")).toBe(false);
    });
});
