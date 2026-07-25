import crypto from "crypto";
import { Prompt } from "./models";
import { encrypt, sha256Hex } from "./encryption";
import { nanoid } from "./nanoid";
import { consumeRateLimit } from "./rate-limit";
import { AUTHED_DAILY_LIMIT, GUEST_DAILY_LIMIT, MAX_CHARS } from "./config";
import { countChars, expiryFromPreset, type ExpiryPreset } from "./qr-mode";

const DAY_MS = 24 * 60 * 60 * 1000;

// Strip control characters but keep meaningful whitespace (\n, \t) —
// indentation fidelity is a product requirement (SPEC §8).
export function sanitizeContent(text: string): string {
    return (
        text
            // Form submission encodes newlines as CRLF — normalize back.
            .replace(/\r\n?/g, "\n")
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    );
}

export type CreateResult =
    | {
          slug: string;
          claimToken: string | null;
          expiresAt: string | null;
      }
    | { error: string; code: "rate_limited" | "invalid" | "internal" };

/**
 * E2E variant (SPEC §5 M4): the client encrypted in-browser and sends
 * only ciphertext — the key lives in the URL fragment and never reaches
 * us. No title, no search, no dedup, no server-side decryption. The
 * client-supplied charCount is display metadata, capped for sanity.
 */
export async function createE2ePromptRecord(opts: {
    ciphertext: string; // b64url, includes the GCM tag
    iv: string; // b64url
    charCount?: number;
    isOneTimeView?: boolean;
    expiresIn?: ExpiryPreset;
    userId: string | null;
    clientIp: string;
}): Promise<CreateResult> {
    const { userId, clientIp } = opts;
    const isGuest = !userId;

    const rateKey = userId ? `user:${userId}` : `ip:${clientIp}`;
    const limit = userId ? AUTHED_DAILY_LIMIT : GUEST_DAILY_LIMIT;
    const { allowed } = await consumeRateLimit(rateKey, "generate", limit, DAY_MS);
    if (!allowed) {
        return { error: "Daily limit reached. Please try again tomorrow.", code: "rate_limited" };
    }

    if (!/^[A-Za-z0-9_-]{20,}$/.test(opts.ciphertext) || !/^[A-Za-z0-9_-]{10,32}$/.test(opts.iv)) {
        return { error: "Malformed ciphertext", code: "invalid" };
    }
    // b64url expands bytes ~4/3 — reject anything beyond the MAX_CHARS budget.
    if (opts.ciphertext.length > MAX_CHARS * 6) {
        return { error: "Ciphertext is too large", code: "invalid" };
    }

    const expiresAt = expiryFromPreset(opts.expiresIn ?? "30d", isGuest);
    const claimToken = isGuest ? crypto.randomBytes(24).toString("base64url") : null;

    const prompt = await Prompt.create({
        shortSlug: nanoid(),
        encryptedContent: opts.ciphertext,
        iv: opts.iv,
        authTag: null, // tag is inside the WebCrypto ciphertext
        e2e: true,
        contentHash: sha256Hex(opts.ciphertext),
        title: "🔒 End-to-end encrypted",
        charCount: Math.min(Math.max(opts.charCount ?? 0, 0), MAX_CHARS),
        ownerUserId: userId,
        isGuest,
        claimToken,
        isOneTimeView: opts.isOneTimeView ?? false,
        expiresAt,
    });

    return {
        slug: prompt.shortSlug,
        claimToken,
        expiresAt: expiresAt?.toISOString() ?? null,
    };
}

/**
 * Shared prompt creation used by the web server action and the JSON API
 * (SPEC §6): rate limit → sanitize → dedup → encrypt → insert.
 * Caller must be connected to the DB already.
 */
export async function createPromptRecord(opts: {
    content: string;
    isOneTimeView?: boolean;
    expiresIn?: ExpiryPreset;
    userId: string | null;
    clientIp: string;
}): Promise<CreateResult> {
    const { userId, clientIp } = opts;
    const isGuest = !userId;

    const rateKey = userId ? `user:${userId}` : `ip:${clientIp}`;
    const limit = userId ? AUTHED_DAILY_LIMIT : GUEST_DAILY_LIMIT;
    const { allowed } = await consumeRateLimit(rateKey, "generate", limit, DAY_MS);
    if (!allowed) {
        return { error: "Daily limit reached. Please try again tomorrow.", code: "rate_limited" };
    }

    const content = sanitizeContent(opts.content);
    if (content.length === 0) {
        return { error: "Content is required", code: "invalid" };
    }
    if (content.length > MAX_CHARS) {
        return {
            error: `Content is too long (max ${MAX_CHARS.toLocaleString()} characters)`,
            code: "invalid",
        };
    }

    const isOneTimeView = opts.isOneTimeView ?? false;
    const contentHash = sha256Hex(content);

    // Silent dedup (SPEC §8): same content + owner + options within 24 h
    // returns the existing slug instead of minting a new record.
    const existing = await Prompt.findOne({
        contentHash,
        ownerUserId: userId,
        isOneTimeView,
        deletedAt: null,
        createdAt: { $gt: new Date(Date.now() - DAY_MS) },
    });
    if (existing && (!existing.expiresAt || existing.expiresAt > new Date())) {
        return {
            slug: existing.shortSlug,
            claimToken: existing.isGuest ? existing.claimToken : null,
            expiresAt: existing.expiresAt?.toISOString() ?? null,
        };
    }

    const { iv, content: encryptedContent, authTag } = encrypt(content);
    // "never" requires login; guests are silently capped at 30 days (SPEC §5.1).
    const expiresAt = expiryFromPreset(opts.expiresIn ?? "30d", isGuest);
    const claimToken = isGuest ? crypto.randomBytes(24).toString("base64url") : null;

    const prompt = await Prompt.create({
        shortSlug: nanoid(),
        encryptedContent,
        iv,
        authTag,
        contentHash,
        title: content.slice(0, 60),
        charCount: countChars(content),
        ownerUserId: userId,
        isGuest,
        claimToken,
        isOneTimeView,
        expiresAt,
    });

    return {
        slug: prompt.shortSlug,
        claimToken,
        expiresAt: expiresAt?.toISOString() ?? null,
    };
}
