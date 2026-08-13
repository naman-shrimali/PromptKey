import { CatalogPrompt, Purchase, Subscription } from "./models";
import { decrypt } from "./encryption";
import { PAST_DUE_GRACE_DAYS, PROMPT_DEFAULT_INR } from "./config";

// Marketplace access rules (SPEC §5 M5):
//  - active subscription (or past_due within a 3-day grace) → whole catalog
//  - paid per-prompt purchase → that prompt forever, survives sub lapse

const GRACE_MS = PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000;

export async function hasActiveSubscription(userId: string): Promise<boolean> {
    const now = new Date();
    const sub = await Subscription.findOne({
        userId,
        status: { $in: ["active", "past_due"] },
    })
        .sort({ currentPeriodEnd: -1 })
        .lean<{ status: string; currentPeriodEnd: Date | null }>();
    if (!sub?.currentPeriodEnd) return false;

    const horizon =
        sub.status === "past_due"
            ? new Date(sub.currentPeriodEnd.getTime() + GRACE_MS)
            : sub.currentPeriodEnd;
    return horizon > now;
}

export async function hasPurchased(userId: string, catalogPromptId: string): Promise<boolean> {
    const purchase = await Purchase.findOne({
        userId,
        catalogPromptId,
        status: "paid",
    }).select("_id");
    return !!purchase;
}

export async function hasAccess(
    userId: string | null,
    catalogPromptId: string
): Promise<boolean> {
    if (!userId) return false;
    if (await hasPurchased(userId, catalogPromptId)) return true;
    return hasActiveSubscription(userId);
}

export function priceOf(catalogPrompt: { priceINR?: number | null }): number {
    // null → default price; an explicit 0 means free.
    return catalogPrompt.priceINR ?? PROMPT_DEFAULT_INR;
}

export function isFreePrompt(catalogPrompt: { priceINR?: number | null }): boolean {
    return priceOf(catalogPrompt) === 0;
}

/**
 * Access check that knows about free prompts (priceINR: 0). Free content
 * is readable by everyone, signed in or not — it's the top of the funnel.
 * Prefer this over hasAccess() wherever the prompt document is in hand.
 */
export async function hasAccessToPrompt(
    userId: string | null,
    catalogPrompt: { _id: unknown; priceINR?: number | null }
): Promise<boolean> {
    if (isFreePrompt(catalogPrompt)) return true;
    return hasAccess(userId, String(catalogPrompt._id));
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Serialize a catalog prompt for public consumption. This is the
 * paywall's choke point: unless `withContent` is true, variant *content*
 * fields never leave this function — not even encrypted (SPEC §5 M5:
 * "not even in the HTML payload behind CSS").
 */
export function serializeCatalogPrompt(doc: any, withContent: boolean) {
    const base = {
        slug: doc.slug as string,
        title: doc.title as string,
        description: doc.description as string,
        category: doc.category as string,
        previewText: doc.previewText as string,
        priceINR: priceOf(doc),
        isFree: isFreePrompt(doc),
        ratingAvg: doc.ratingAvg as number,
        ratingCount: doc.ratingCount as number,
        models: (doc.variants ?? []).map((v: any) => ({
            model: v.model as string,
            modelLabel: v.modelLabel as string,
        })),
    };
    if (!withContent) return { ...base, locked: true as const };

    return {
        ...base,
        locked: false as const,
        variants: (doc.variants ?? []).map((v: any) => ({
            model: v.model as string,
            modelLabel: v.modelLabel as string,
            content: decrypt(v.iv, v.content, v.authTag),
        })),
    };
}

export async function findPublishedCatalogPrompt(slug: string) {
    return CatalogPrompt.findOne({ slug, isPublished: true });
}
