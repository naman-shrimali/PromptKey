// Last 5 created items, kept in chrome.storage.local (SPEC §5 M3).

export type HistoryItem = {
    mode: "offline" | "link";
    preview: string; // first 60 chars — never the full text
    url?: string;
    slug?: string;
    at: string;
};

const KEY = "pkHistory";
const MAX = 5;

export async function addHistory(item: HistoryItem): Promise<void> {
    const stored = await browser.storage.local.get(KEY);
    const list = (stored[KEY] as HistoryItem[] | undefined) ?? [];
    const next = [item, ...list.filter((h) => !(item.slug && h.slug === item.slug))].slice(0, MAX);
    await browser.storage.local.set({ [KEY]: next });
}

export async function getHistory(): Promise<HistoryItem[]> {
    const stored = await browser.storage.local.get(KEY);
    return (stored[KEY] as HistoryItem[] | undefined) ?? [];
}
