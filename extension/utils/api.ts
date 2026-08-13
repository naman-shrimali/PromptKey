import { getSettings } from "./settings";

// Talks to the web app's JSON API (SPEC §6). Auth: the session cookie
// rides along via credentials:include when the browser allows it;
// otherwise the API token from the options page (Bearer) applies.

type ApiEnvelope<T> = { data: T } | { error: { code: string; message: string } };

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const { apiBase, apiToken } = await getSettings();
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
        ...(init.headers as Record<string, string>),
    };
    const res = await fetch(`${apiBase}${path}`, {
        ...init,
        headers,
        credentials: "include",
    });
    const body = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
    if (!body) throw new Error(`API error (${res.status})`);
    if ("error" in body) throw new Error(body.error.message);
    return body.data;
}

export type CreatedLink = {
    slug: string;
    url: string;
    claimToken?: string;
    expiresAt: string | null;
};

export function createLink(
    content: string,
    opts: { expiresIn?: string; oneTime?: boolean } = {}
): Promise<CreatedLink> {
    return apiFetch<CreatedLink>("/api/prompts", {
        method: "POST",
        body: JSON.stringify({ content, ...opts }),
    });
}

export type RemoteItem = {
    slug: string;
    url: string;
    title: string;
    charCount: number;
    scanCount: number;
    createdAt: string;
    isFavorite?: boolean;
    isOneTimeView?: boolean;
    e2e?: boolean;
    tags?: string[];
};

export async function fetchRemoteHistory(limit = 5): Promise<RemoteItem[] | null> {
    try {
        const data = await apiFetch<{ items: RemoteItem[] }>(`/api/prompts?limit=${limit}`);
        return data.items;
    } catch {
        return null; // signed out / unreachable — history stays local
    }
}

/** The signed-in user's saved prompts, for the popup's Library picker. */
export async function fetchLibrary(limit = 50): Promise<RemoteItem[] | null> {
    try {
        const data = await apiFetch<{ items: RemoteItem[] }>(`/api/prompts?limit=${limit}`);
        return data.items;
    } catch {
        return null;
    }
}

/**
 * Full plaintext of one owned prompt. Uses the owner endpoint rather than
 * the public /{slug}/raw route on purpose: reading your own library must
 * not count as a scan or consume a one-time view.
 */
export async function fetchPromptContent(slug: string): Promise<string> {
    const data = await apiFetch<{ content: string | null; contentUnavailable?: string }>(
        `/api/prompts/${encodeURIComponent(slug)}`
    );
    if (data.content === null) {
        throw new Error(
            data.contentUnavailable === "e2e"
                ? "This prompt is end-to-end encrypted — only the link's key can open it."
                : "This prompt couldn't be decrypted."
        );
    }
    return data.content;
}
