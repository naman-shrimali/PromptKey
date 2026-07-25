"use server";

import { headers } from "next/headers";
import { auth } from "@/auth";
import dbConnect from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { CatalogPrompt } from "@/lib/models";
import { hasAccess } from "@/lib/market-access";
import { createPromptRecord } from "@/lib/create-prompt";

/* eslint-disable @typescript-eslint/no-explicit-any */

async function accessibleVariant(catalogSlug: string, model: string) {
    const session = await auth();
    if (!session?.user?.id) return { error: "Sign in first" as const };

    await dbConnect();
    const prompt = await CatalogPrompt.findOne({ slug: catalogSlug, isPublished: true });
    if (!prompt) return { error: "Prompt not found" as const };

    // The paywall applies to server actions exactly like API routes.
    if (!(await hasAccess(session.user.id, String(prompt._id)))) {
        return { error: "You don't have access to this prompt" as const };
    }

    const variant = (prompt.variants ?? []).find((v: any) => v.model === model);
    if (!variant) return { error: "No such variant" as const };

    return {
        userId: session.user.id,
        content: decrypt(variant.iv, variant.content, variant.authTag),
    };
}

/**
 * "Send to phone" (SPEC §5 M5): materialize the unlocked variant as a
 * regular link-mode Prompt owned by the buyer, 24 h expiry — the core
 * product delivers the purchase.
 */
export async function sendVariantToPhone(catalogSlug: string, model: string) {
    const resolved = await accessibleVariant(catalogSlug, model);
    if ("error" in resolved) return { error: resolved.error };

    const headersList = await headers();
    const clientIp = (headersList.get("x-forwarded-for") || "unknown").split(",")[0].trim();

    const result = await createPromptRecord({
        content: resolved.content,
        expiresIn: "24h",
        userId: resolved.userId,
        clientIp,
    });
    if ("error" in result) return { error: result.error };
    return { success: true, slug: result.slug };
}

/** "Save to my library": permanent editable copy in the dashboard. */
export async function saveVariantToLibrary(catalogSlug: string, model: string) {
    const resolved = await accessibleVariant(catalogSlug, model);
    if ("error" in resolved) return { error: resolved.error };

    const headersList = await headers();
    const clientIp = (headersList.get("x-forwarded-for") || "unknown").split(",")[0].trim();

    const result = await createPromptRecord({
        content: resolved.content,
        expiresIn: "never",
        userId: resolved.userId,
        clientIp,
    });
    if ("error" in result) return { error: result.error };
    return { success: true, slug: result.slug };
}
