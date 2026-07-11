import { describe, expect, it } from "vitest";

process.env.ENCRYPTION_KEY = "test-key-material-does-not-need-a-fixed-length";

// Import after the env var is set — the key is derived lazily.
import { encrypt, decrypt, sha256Hex } from "@/lib/encryption";

// Unicode fixtures per SPEC §8: emoji, CJK, RTL, zero-width chars, and
// whitespace-sensitive code must round-trip byte-exact.
const FIXTURES = [
    "hello world",
    "emoji 🎉🔑💜 and skin tones 👍🏽",
    "中文本文とひらがなと한국어",
    "مرحبا بالعالم — עברית",
    "zero​width‍ chars﻿",
    "  leading indent\n\n\ttabbed line\n    four spaces\ntrailing blank line\n\n",
    "a".repeat(50_000),
];

describe("AES-256-GCM encryption", () => {
    it("round-trips every fixture byte-exact", () => {
        for (const original of FIXTURES) {
            const { iv, content, authTag } = encrypt(original);
            expect(decrypt(iv, content, authTag)).toBe(original);
        }
    });

    it("produces a fresh IV per call (no ciphertext reuse)", () => {
        const a = encrypt("same text");
        const b = encrypt("same text");
        expect(a.iv).not.toBe(b.iv);
        expect(a.content).not.toBe(b.content);
    });

    it("rejects tampered ciphertext (GCM integrity)", () => {
        const { iv, content, authTag } = encrypt("integrity matters");
        const flipped = (parseInt(content[0], 16) ^ 1).toString(16) + content.slice(1);
        expect(() => decrypt(iv, flipped, authTag)).toThrow();
    });

    it("rejects a tampered auth tag", () => {
        const { iv, content, authTag } = encrypt("integrity matters");
        const flipped = (parseInt(authTag[0], 16) ^ 1).toString(16) + authTag.slice(1);
        expect(() => decrypt(iv, content, flipped)).toThrow();
    });

    it("hashes content deterministically", () => {
        expect(sha256Hex("abc")).toBe(sha256Hex("abc"));
        expect(sha256Hex("abc")).not.toBe(sha256Hex("abd"));
    });
});
