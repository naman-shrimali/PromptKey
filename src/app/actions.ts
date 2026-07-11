"use server";

import crypto from "crypto";
import { z } from "zod";
import dbConnect from "@/lib/db";
import { Prompt } from "@/lib/models";
import { encrypt, sha256Hex } from "@/lib/encryption";
import { nanoid } from "@/lib/nanoid";
import { consumeRateLimit } from "@/lib/rate-limit";
import { MAX_CHARS, GUEST_DAILY_LIMIT, AUTHED_DAILY_LIMIT } from "@/lib/config";
import { EXPIRY_PRESETS, expiryFromPreset } from "@/lib/qr-mode";
import { headers } from "next/headers";
import { auth } from "@/auth";

const DAY_MS = 24 * 60 * 60 * 1000;

// Strip control characters but keep meaningful whitespace (\n, \t) —
// indentation fidelity is a product requirement (SPEC §8).
function stripControlChars(text: string): string {
    return (
        text
            // Form submission encodes newlines as CRLF — normalize back.
            .replace(/\r\n?/g, "\n")
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    );
}

const generateSchema = z.object({
    content: z
        .string()
        .min(1, "Content is required")
        .max(MAX_CHARS, `Content is too long (max ${MAX_CHARS.toLocaleString()} characters)`),
    isOneTimeView: z.boolean().optional(),
    expiresIn: z.enum(EXPIRY_PRESETS).optional(),
});

export type GenerateInput = z.infer<typeof generateSchema>;

export type GenerateState = {
    success?: boolean;
    slug?: string;
    claimToken?: string | null;
    expiresAt?: string | null;
    error?: { content?: string[]; isOneTimeView?: string[]; expiresIn?: string[] } | string;
};

export async function generatePrompt(input: GenerateInput): Promise<GenerateState> {
    try {
        const validatedFields = generateSchema.safeParse(input);

        if (!validatedFields.success) {
            return { error: z.flattenError(validatedFields.error).fieldErrors };
        }

        const session = await auth();

        await dbConnect();

        // Rate limiting (SPEC §7): per user when signed in, per IP for guests.
        const headersList = await headers();
        const clientIp = (headersList.get("x-forwarded-for") || "unknown")
            .split(",")[0]
            .trim();
        const rateKey = session?.user?.id ? `user:${session.user.id}` : `ip:${clientIp}`;
        const limit = session?.user ? AUTHED_DAILY_LIMIT : GUEST_DAILY_LIMIT;

        const { allowed } = await consumeRateLimit(rateKey, "generate", limit, DAY_MS);
        if (!allowed) {
            return { error: "Daily limit reached. Please try again tomorrow." };
        }

        const content = stripControlChars(validatedFields.data.content);
        if (content.length === 0) {
            return { error: { content: ["Content is required"] } };
        }
        const isOneTimeView = validatedFields.data.isOneTimeView ?? false;
        const contentHash = sha256Hex(content);
        const ownerUserId = session?.user?.id ?? null;

        // Silent dedup (SPEC §8): same content + owner + options within 24 h
        // returns the existing slug instead of minting a new record.
        const existing = await Prompt.findOne({
            contentHash,
            ownerUserId,
            isOneTimeView,
            deletedAt: null,
            createdAt: { $gt: new Date(Date.now() - DAY_MS) },
        });
        if (existing && (!existing.expiresAt || existing.expiresAt > new Date())) {
            return {
                success: true,
                slug: existing.shortSlug,
                claimToken: existing.isGuest ? existing.claimToken : null,
                expiresAt: existing.expiresAt?.toISOString() ?? null,
            };
        }

        const { iv, content: encryptedContent, authTag } = encrypt(content);
        const isGuest = !session?.user;
        // "never" requires login; guests are silently capped at 30 days (SPEC §5.1).
        const expiresAt = expiryFromPreset(validatedFields.data.expiresIn ?? "30d", isGuest);
        const claimToken = isGuest ? crypto.randomBytes(24).toString("base64url") : null;

        const prompt = await Prompt.create({
            shortSlug: nanoid(),
            encryptedContent,
            iv,
            authTag,
            contentHash,
            title: content.slice(0, 60),
            charCount: [...content].length, // code points, not UTF-16 units (SPEC §8)
            ownerUserId,
            isGuest,
            claimToken,
            isOneTimeView,
            expiresAt,
        });

        return {
            success: true,
            slug: prompt.shortSlug,
            claimToken,
            expiresAt: expiresAt?.toISOString() ?? null,
        };
    } catch (error) {
        console.error("Failed to generate prompt:", error);
        return {
            error: "Failed to generate prompt. Please try again.",
        };
    }
}

export async function deletePrompt(formData: FormData) {
    const session = await auth();
    if (!session?.user) return;

    const id = formData.get("id");
    await dbConnect();
    // Soft delete (SPEC §4); TTL hard-purges after 30 days.
    await Prompt.updateOne(
        { _id: id, ownerUserId: session.user.id },
        { $set: { deletedAt: new Date() } }
    );
}
