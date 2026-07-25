/**
 * One-off migration: AES-256-CBC → AES-256-GCM (SPEC §2, milestone M0).
 *
 * For every prompt without an authTag:
 *   1. decrypt with the legacy scheme (raw ENCRYPTION_KEY as CBC key),
 *   2. re-encrypt with AES-256-GCM using an HKDF-derived key,
 *   3. backfill contentHash / title / charCount,
 *   4. promote options.isOneTimeView and options.expiresAt to top level.
 *
 * Usage:
 *   MONGODB_URI=... ENCRYPTION_KEY=... node scripts/migrate-encryption.mjs [--dry-run]
 *
 * Records that fail legacy decryption are left untouched and reported;
 * pre-launch it's acceptable to delete them instead (SPEC §2).
 */

import crypto from "node:crypto";
import { MongoClient } from "mongodb";

const { MONGODB_URI, ENCRYPTION_KEY } = process.env;
if (!MONGODB_URI || !ENCRYPTION_KEY) {
    console.error("Set MONGODB_URI and ENCRYPTION_KEY env variables first.");
    process.exit(1);
}
const dryRun = process.argv.includes("--dry-run");

// Legacy scheme (src/lib/encryption.ts before M0): raw env string as key.
function decryptLegacyCbc(ivHex, encryptedHex) {
    const decipher = crypto.createDecipheriv(
        "aes-256-cbc",
        Buffer.from(ENCRYPTION_KEY),
        Buffer.from(ivHex, "hex")
    );
    return Buffer.concat([
        decipher.update(Buffer.from(encryptedHex, "hex")),
        decipher.final(),
    ]).toString("utf8");
}

// Must match src/lib/encryption.ts exactly.
const GCM_KEY = Buffer.from(
    crypto.hkdfSync("sha256", ENCRYPTION_KEY, Buffer.alloc(0), "promptkey:content-encryption:v1", 32)
);

function encryptGcm(text) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", GCM_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
    return {
        iv: iv.toString("hex"),
        encryptedContent: encrypted.toString("hex"),
        authTag: cipher.getAuthTag().toString("hex"),
    };
}

const client = new MongoClient(MONGODB_URI);
await client.connect();
const prompts = client.db().collection("prompts");

const legacy = await prompts
    .find({ authTag: { $exists: false }, e2e: { $ne: true } })
    .toArray();
console.log(`${legacy.length} legacy record(s) to migrate${dryRun ? " (dry run)" : ""}.`);

let migrated = 0;
const failed = [];

for (const doc of legacy) {
    let plaintext;
    try {
        plaintext = decryptLegacyCbc(doc.iv, doc.encryptedContent);
    } catch (error) {
        failed.push({ slug: doc.shortSlug, reason: error.message });
        continue;
    }

    const gcm = encryptGcm(plaintext);
    const update = {
        $set: {
            ...gcm,
            contentHash: crypto.createHash("sha256").update(plaintext, "utf8").digest("hex"),
            title: plaintext.slice(0, 60),
            charCount: [...plaintext].length,
            isOneTimeView: doc.options?.isOneTimeView ?? false,
            expiresAt: doc.options?.expiresAt ?? null,
        },
        $unset: { options: "" },
    };

    if (!dryRun) {
        await prompts.updateOne({ _id: doc._id }, update);
    }
    migrated += 1;
}

console.log(`Migrated ${migrated}, failed ${failed.length}.`);
for (const f of failed) {
    console.log(`  FAILED ${f.slug}: ${f.reason} (delete it or fix the key)`);
}

await client.close();
