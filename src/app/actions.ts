"use server";

import { z } from "zod";
import dbConnect from "@/lib/db";
import { Prompt } from "@/lib/models";
import { createPromptRecord, createE2ePromptRecord } from "@/lib/create-prompt";
import { MAX_CHARS } from "@/lib/config";
import { EXPIRY_PRESETS } from "@/lib/qr-mode";
import { headers } from "next/headers";
import { auth } from "@/auth";

async function requestContext() {
    const session = await auth();
    await dbConnect();
    const headersList = await headers();
    const clientIp = (headersList.get("x-forwarded-for") || "unknown").split(",")[0].trim();
    return { userId: session?.user?.id ?? null, clientIp };
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

        const { userId, clientIp } = await requestContext();
        const result = await createPromptRecord({
            content: validatedFields.data.content,
            isOneTimeView: validatedFields.data.isOneTimeView,
            expiresIn: validatedFields.data.expiresIn,
            userId,
            clientIp,
        });

        if ("error" in result) return { error: result.error };
        return { success: true, ...result };
    } catch (error) {
        console.error("Failed to generate prompt:", error);
        return {
            error: "Failed to generate prompt. Please try again.",
        };
    }
}

const e2eSchema = z.object({
    ciphertext: z.string().min(20),
    iv: z.string().min(10).max(32),
    charCount: z.number().int().min(0).max(MAX_CHARS).optional(),
    isOneTimeView: z.boolean().optional(),
    expiresIn: z.enum(EXPIRY_PRESETS).optional(),
});

/** E2E create (SPEC §5 M4): the browser already encrypted; we never see plaintext. */
export async function generateE2ePrompt(
    input: z.infer<typeof e2eSchema>
): Promise<GenerateState> {
    try {
        const validated = e2eSchema.safeParse(input);
        if (!validated.success) {
            return { error: "Invalid encrypted payload" };
        }

        const { userId, clientIp } = await requestContext();
        const result = await createE2ePromptRecord({ ...validated.data, userId, clientIp });

        if ("error" in result) return { error: result.error };
        return { success: true, ...result };
    } catch (error) {
        console.error("Failed to create E2E prompt:", error);
        return { error: "Failed to generate prompt. Please try again." };
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
