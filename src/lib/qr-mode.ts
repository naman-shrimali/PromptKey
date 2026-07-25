import { QR_DIRECT_DEFAULT, QR_DIRECT_MAX, GUEST_MAX_TTL_DAYS } from "./config";

// Shared client/server logic for the hybrid-encoding decision (SPEC §5.1)
// and expiry presets. No I/O here — keep it unit-testable.

export type QrMode = "offline" | "link";

export type QrModeChoice = {
    defaultMode: QrMode;
    offlineAvailable: boolean;
    /** Why offline mode can't be used (shown on the disabled toggle). */
    offlineUnavailableReason: string | null;
};

/** Counts Unicode code points, not UTF-16 units (SPEC §8). */
export function countChars(text: string): number {
    return [...text].length;
}

/** QR capacity is measured in bytes; emoji/CJK take 3–4 bytes each. */
export function utf8ByteLength(text: string): number {
    return new TextEncoder().encode(text).length;
}

/**
 * Offline-mode thresholds are applied to the UTF-8 byte size (identical
 * to char count for ASCII, stricter for multibyte text) so the payload
 * always fits real QR capacity.
 */
export function chooseQrMode(byteCount: number): QrModeChoice {
    const offlineAvailable = byteCount > 0 && byteCount <= QR_DIRECT_MAX;
    return {
        offlineAvailable,
        offlineUnavailableReason: offlineAvailable
            ? null
            : byteCount === 0
              ? null
              : `Too long for an offline QR (fits ~${QR_DIRECT_MAX.toLocaleString()} chars)`,
        defaultMode: byteCount > 0 && byteCount <= QR_DIRECT_DEFAULT ? "offline" : "link",
    };
}

/**
 * react-qr-code writes byte mode from charCodes and silently truncates
 * anything above 0xFF — emoji/RTL/CJK would corrupt. Re-encode the text
 * as a UTF-8 "binary string" (one char per byte) so scanners decode the
 * exact original text (SPEC §8 byte-exact round-trip).
 */
export function toQrByteValue(text: string): string {
    const bytes = new TextEncoder().encode(text);
    let out = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
        out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return out;
}

// Expiration presets (SPEC §5.1): "never" requires login; guests are
// silently capped at GUEST_MAX_TTL_DAYS.
export const EXPIRY_PRESETS = ["1h", "24h", "7d", "30d", "never"] as const;
export type ExpiryPreset = (typeof EXPIRY_PRESETS)[number];

const HOUR_MS = 60 * 60 * 1000;
const PRESET_MS: Record<Exclude<ExpiryPreset, "never">, number> = {
    "1h": HOUR_MS,
    "24h": 24 * HOUR_MS,
    "7d": 7 * 24 * HOUR_MS,
    "30d": 30 * 24 * HOUR_MS,
};

export const EXPIRY_LABELS: Record<ExpiryPreset, string> = {
    "1h": "1 hour",
    "24h": "24 hours",
    "7d": "7 days",
    "30d": "30 days",
    never: "Never",
};

export function isExpiryPreset(value: unknown): value is ExpiryPreset {
    return typeof value === "string" && (EXPIRY_PRESETS as readonly string[]).includes(value);
}

/**
 * Preset → concrete expiry date. Guests never get "never": they are
 * clamped to GUEST_MAX_TTL_DAYS (SPEC §5.1).
 */
export function expiryFromPreset(
    preset: ExpiryPreset,
    isGuest: boolean,
    now: Date = new Date()
): Date | null {
    if (preset === "never") {
        return isGuest
            ? new Date(now.getTime() + GUEST_MAX_TTL_DAYS * 24 * HOUR_MS)
            : null;
    }
    return new Date(now.getTime() + PRESET_MS[preset]);
}
