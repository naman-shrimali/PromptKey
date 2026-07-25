import { Prompt } from "./models";
import { decrypt } from "./encryption";

/* eslint-disable @typescript-eslint/no-explicit-any */
type PromptDoc = any;

export type ScanResolution =
    | { status: "ok"; prompt: PromptDoc; content: string }
    | { status: "not_found" }
    | { status: "gone" };

/**
 * Atomically claim a one-time view. Exactly one concurrent scan wins:
 * the filter and increment happen in a single findOneAndUpdate, so two
 * simultaneous requests can't both pass a read-then-increment check
 * (SPEC §2). Returns the pre-claim document for the winner, null otherwise.
 */
export async function claimOneTimeView(slug: string): Promise<PromptDoc | null> {
    return Prompt.findOneAndUpdate(
        { shortSlug: slug, isOneTimeView: true, scanCount: 0, deletedAt: null },
        { $inc: { scanCount: 1 }, $set: { lastScanAt: new Date() } }
    );
}

/** Fire-and-forget counter bump for regular (multi-view) prompts. */
export async function recordScan(promptId: unknown): Promise<void> {
    try {
        await Prompt.updateOne(
            { _id: promptId },
            { $inc: { scanCount: 1 }, $set: { lastScanAt: new Date() } }
        );
    } catch {
        // Scan counting must never take the page down (SPEC §8).
    }
}

// Link-preview fetchers and crawlers inflate scan counts (SPEC §2).
const BOT_UA =
    /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|skype|slack|discord|twitter|linkedin|pinterest|embedly|quora|vkshare|google|bing|yandex|baidu|duckduck|headless/i;

export function isBotRequest(userAgent: string | null, purpose?: string | null): boolean {
    if (purpose && /prefetch|preview/i.test(purpose)) return true;
    if (!userAgent) return true;
    return BOT_UA.test(userAgent);
}

/**
 * Resolve a slug to plaintext. Handles missing/deleted (not_found),
 * expired or already-consumed one-time views (gone), and the atomic
 * one-time claim. Does NOT count regular scans — the caller decides
 * (the page counts asynchronously and skips bots; one-time consumption
 * is inherently the count).
 *
 * Pass consumeOneTime=false for bot/prefetch requests so a link preview
 * can't burn someone's one-time view.
 */
export async function resolveScan(
    slug: string,
    { consumeOneTime = true }: { consumeOneTime?: boolean } = {}
): Promise<ScanResolution> {
    const prompt = await Prompt.findOne({ shortSlug: slug, deletedAt: null });
    if (!prompt) return { status: "not_found" };

    // TTL deletion can lag behind the expiry moment — enforce it here.
    if (prompt.expiresAt && prompt.expiresAt <= new Date()) return { status: "gone" };

    try {
        if (prompt.isOneTimeView) {
            if (!consumeOneTime) return { status: "gone" };
            const claimed = await claimOneTimeView(slug);
            if (!claimed) return { status: "gone" };
            return { status: "ok", prompt: claimed, content: decryptPrompt(claimed) };
        }

        return { status: "ok", prompt, content: decryptPrompt(prompt) };
    } catch (error) {
        // Undecryptable (legacy CBC record or tampered ciphertext) — the
        // reader can't be helped; show the honest gone page.
        console.error(`Failed to decrypt prompt ${slug}:`, error);
        return { status: "gone" };
    }
}

function decryptPrompt(prompt: PromptDoc): string {
    // Legacy CBC records have no authTag; they need the migration script
    // (scripts/migrate-encryption.mjs). Treat them as unreadable.
    if (!prompt.authTag) {
        throw new Error(`Prompt ${prompt.shortSlug} predates GCM migration`);
    }
    return decrypt(prompt.iv, prompt.encryptedContent, prompt.authTag);
}
