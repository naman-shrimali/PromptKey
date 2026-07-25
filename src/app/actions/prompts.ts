"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import dbConnect from "@/lib/db";
import { Prompt } from "@/lib/models";
import { decrypt } from "@/lib/encryption";
import { buildContentUpdate } from "@/lib/living-qr";
import { expiryFromPreset, isExpiryPreset } from "@/lib/qr-mode";
import { MAX_CHARS } from "@/lib/config";

// All actions here are owner-scoped: every query filters on the session
// user's id, so a forged prompt id can never touch someone else's data.

async function ownedPrompt(id: string) {
    const session = await auth();
    if (!session?.user?.id) return null;
    await dbConnect();
    const prompt = await Prompt.findOne({
        _id: id,
        ownerUserId: session.user.id,
        deletedAt: null,
    });
    return prompt;
}

function decryptDoc(doc: { iv: string; encryptedContent: string; authTag?: string | null }) {
    if (!doc.authTag) throw new Error("Record predates GCM migration");
    return decrypt(doc.iv, doc.encryptedContent, doc.authTag);
}

/** Plaintext for the dashboard "copy text" action — owners only. */
export async function getPromptContent(id: string): Promise<{ content?: string; error?: string }> {
    try {
        const prompt = await ownedPrompt(id);
        if (!prompt) return { error: "Not found" };
        return { content: decryptDoc(prompt) };
    } catch {
        return { error: "Could not decrypt this prompt" };
    }
}

const updateSchema = z.object({
    id: z.string().min(1),
    content: z.string().min(1).max(MAX_CHARS).optional(),
    tags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
    expiresIn: z.string().optional(),
});

/**
 * Living QR edit (SPEC §5 M2): same slug, new content; previous content
 * goes into version history. Also updates tags / expiry when provided.
 */
export async function updatePrompt(input: z.infer<typeof updateSchema>) {
    try {
        const parsed = updateSchema.safeParse(input);
        if (!parsed.success) return { error: "Invalid input" };
        const { id, content, tags, expiresIn } = parsed.data;

        const prompt = await ownedPrompt(id);
        if (!prompt) return { error: "Not found" };

        const $set: Record<string, unknown> = {};

        if (content !== undefined) {
            let current: string | null = null;
            try {
                current = decryptDoc(prompt);
            } catch {
                current = null; // undecryptable legacy record: overwrite it
            }
            if (content !== current) {
                Object.assign($set, buildContentUpdate(prompt, content));
            }
        }
        if (tags !== undefined) {
            $set.tags = [...new Set(tags.map((t) => t.toLowerCase()))];
        }
        if (expiresIn !== undefined && isExpiryPreset(expiresIn)) {
            $set.expiresAt = expiryFromPreset(expiresIn, false);
        }

        if (Object.keys($set).length > 0) {
            await Prompt.updateOne({ _id: prompt._id }, { $set });
        }

        revalidatePath("/dashboard");
        revalidatePath(`/dashboard/${id}`);
        return { success: true, edited: "versions" in $set };
    } catch (error) {
        console.error("updatePrompt failed:", error);
        return { error: "Failed to save changes" };
    }
}

export async function toggleFavorite(id: string) {
    const prompt = await ownedPrompt(id);
    if (!prompt) return { error: "Not found" };
    await Prompt.updateOne({ _id: prompt._id }, { $set: { isFavorite: !prompt.isFavorite } });
    revalidatePath("/dashboard");
    return { success: true, isFavorite: !prompt.isFavorite };
}

/** Restore a history entry by re-applying it as a new edit (slug unchanged). */
export async function restoreVersion(id: string, versionIndex: number) {
    try {
        const prompt = await ownedPrompt(id);
        if (!prompt) return { error: "Not found" };

        const version = prompt.versions?.[versionIndex];
        if (!version) return { error: "Version not found" };

        const restored = decryptDoc(version);
        await Prompt.updateOne({ _id: prompt._id }, { $set: buildContentUpdate(prompt, restored) });

        revalidatePath("/dashboard");
        revalidatePath(`/dashboard/${id}`);
        return { success: true };
    } catch (error) {
        console.error("restoreVersion failed:", error);
        return { error: "Failed to restore version" };
    }
}

export async function softDeletePrompt(id: string) {
    const prompt = await ownedPrompt(id);
    if (!prompt) return { error: "Not found" };
    await Prompt.updateOne({ _id: prompt._id }, { $set: { deletedAt: new Date() } });
    revalidatePath("/dashboard");
    return { success: true };
}
