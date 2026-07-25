import { describe, expect, it } from "vitest";
import { chooseQrMode, countChars, expiryFromPreset, isExpiryPreset, toQrByteValue, utf8ByteLength } from "@/lib/qr-mode";
import { QR_DIRECT_DEFAULT, QR_DIRECT_MAX, GUEST_MAX_TTL_DAYS, SLUG_LENGTH } from "@/lib/config";
import { nanoid } from "@/lib/nanoid";

describe("chooseQrMode (SPEC §5.1 hybrid encoding)", () => {
    it("defaults to offline at or below QR_DIRECT_DEFAULT", () => {
        for (const n of [1, 250, QR_DIRECT_DEFAULT]) {
            const choice = chooseQrMode(n);
            expect(choice.defaultMode).toBe("offline");
            expect(choice.offlineAvailable).toBe(true);
        }
    });

    it("defaults to link between QR_DIRECT_DEFAULT and QR_DIRECT_MAX, offline still available", () => {
        for (const n of [QR_DIRECT_DEFAULT + 1, QR_DIRECT_MAX]) {
            const choice = chooseQrMode(n);
            expect(choice.defaultMode).toBe("link");
            expect(choice.offlineAvailable).toBe(true);
        }
    });

    it("is link-only above QR_DIRECT_MAX, with a human-readable reason", () => {
        const choice = chooseQrMode(QR_DIRECT_MAX + 1);
        expect(choice.defaultMode).toBe("link");
        expect(choice.offlineAvailable).toBe(false);
        expect(choice.offlineUnavailableReason).toMatch(/too long/i);
    });

    it("treats empty input as link default with no reason", () => {
        const choice = chooseQrMode(0);
        expect(choice.offlineAvailable).toBe(false);
        expect(choice.offlineUnavailableReason).toBeNull();
    });
});

describe("utf8 handling", () => {
    it("measures capacity in UTF-8 bytes", () => {
        expect(utf8ByteLength("abc")).toBe(3);
        expect(utf8ByteLength("🎉")).toBe(4);
        expect(utf8ByteLength("é")).toBe(2);
    });

    it("re-encodes text as a byte string that decodes back to the original", () => {
        const fixtures = ["hello", "party 🎉 time", "before — after", "مرحبا עברית", "中文と한국어"];
        const decoder = new TextDecoder();
        for (const text of fixtures) {
            const byteValue = toQrByteValue(text);
            // every char is a single byte (what react-qr-code will emit)
            expect(Math.max(...[...byteValue].map((c) => c.charCodeAt(0)))).toBeLessThan(256);
            const bytes = Uint8Array.from([...byteValue].map((c) => c.charCodeAt(0)));
            expect(decoder.decode(bytes)).toBe(text);
        }
    });
});

describe("countChars", () => {
    it("counts code points, not UTF-16 units (SPEC §8)", () => {
        expect(countChars("🎉")).toBe(1);
        expect(countChars("a🎉b")).toBe(3);
        expect(countChars("👍🏽")).toBe(2); // emoji + skin-tone modifier
    });
});

describe("expiryFromPreset", () => {
    const now = new Date("2026-07-11T00:00:00Z");

    it("maps timed presets to the right horizon", () => {
        expect(expiryFromPreset("1h", true, now)!.getTime() - now.getTime()).toBe(3_600_000);
        expect(expiryFromPreset("24h", true, now)!.getTime() - now.getTime()).toBe(86_400_000);
        expect(expiryFromPreset("7d", false, now)!.getTime() - now.getTime()).toBe(7 * 86_400_000);
        expect(expiryFromPreset("30d", false, now)!.getTime() - now.getTime()).toBe(30 * 86_400_000);
    });

    it("gives authed users a true never (null)", () => {
        expect(expiryFromPreset("never", false, now)).toBeNull();
    });

    it("clamps guests' never to GUEST_MAX_TTL_DAYS (SPEC §5.1)", () => {
        const clamped = expiryFromPreset("never", true, now);
        expect(clamped).not.toBeNull();
        expect(clamped!.getTime() - now.getTime()).toBe(GUEST_MAX_TTL_DAYS * 86_400_000);
    });

    it("validates presets", () => {
        expect(isExpiryPreset("7d")).toBe(true);
        expect(isExpiryPreset("2y")).toBe(false);
        expect(isExpiryPreset(null)).toBe(false);
    });
});

describe("slug generation (SPEC §4)", () => {
    it("is SLUG_LENGTH chars from the unambiguous alphabet", () => {
        for (let i = 0; i < 200; i++) {
            const slug = nanoid();
            expect(slug).toHaveLength(SLUG_LENGTH);
            expect(slug).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz]+$/);
            expect(slug).not.toMatch(/[0O1lI]/);
        }
    });

    it("does not collide across a quick sample", () => {
        const seen = new Set(Array.from({ length: 5000 }, () => nanoid()));
        expect(seen.size).toBe(5000);
    });
});
