// Mirrors src/lib/config.ts on the web app — the extension is a separate
// package, so the two constants it needs are duplicated here on purpose.
export const QR_DIRECT_MAX = 1_000; // offline mode available at or below this (UTF-8 bytes)
export const QR_DIRECT_DEFAULT = 500; // offline is the default at or below this
export const MAX_CHARS = 50_000;

export const DEFAULT_API_BASE = "https://promptqr-nu.vercel.app";

export type Settings = {
    apiBase: string;
    apiToken: string | null;
};

export async function getSettings(): Promise<Settings> {
    const stored = await browser.storage.local.get(["apiBase", "apiToken"]);
    return {
        apiBase: ((stored.apiBase as string) || DEFAULT_API_BASE).replace(/\/$/, ""),
        apiToken: (stored.apiToken as string) || null,
    };
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
    await browser.storage.local.set(settings);
}

export function utf8Bytes(text: string): number {
    return new TextEncoder().encode(text).length;
}
