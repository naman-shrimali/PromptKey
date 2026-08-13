// Detects the big three AI chat sites so a prompt can be inserted
// straight into their composer instead of going out as a QR.
//
// Selector chains are ordered specific → generic on purpose: these sites
// redesign often, so a site-specific selector that breaks falls through
// to a structural one that usually survives. If insertion starts failing
// on a site, this array is the only thing that should need editing.

export type AiSiteId = "claude" | "chatgpt" | "gemini";

export type AiSite = {
    id: AiSiteId;
    label: string;
    selectors: string[];
};

const SITES: Array<{ hosts: RegExp; site: AiSite }> = [
    {
        hosts: /^claude\.ai$/i,
        site: {
            id: "claude",
            label: "Claude",
            selectors: [
                'div.ProseMirror[contenteditable="true"]',
                'div[contenteditable="true"][role="textbox"]',
                'div[data-placeholder][contenteditable="true"]',
                'div[contenteditable="true"]',
            ],
        },
    },
    {
        hosts: /^(chatgpt\.com|chat\.openai\.com)$/i,
        site: {
            id: "chatgpt",
            label: "ChatGPT",
            selectors: [
                "#prompt-textarea",
                'div.ProseMirror[contenteditable="true"]',
                'div[contenteditable="true"][role="textbox"]',
                "textarea[data-id]",
                'div[contenteditable="true"]',
            ],
        },
    },
    {
        hosts: /^gemini\.google\.com$/i,
        site: {
            id: "gemini",
            label: "Gemini",
            selectors: [
                'rich-textarea div[contenteditable="true"]',
                'div.ql-editor[contenteditable="true"]',
                'div[contenteditable="true"][role="textbox"]',
                'div[contenteditable="true"]',
            ],
        },
    },
];

export function detectAiSite(url: string | undefined): AiSite | null {
    if (!url) return null;
    let host: string;
    try {
        host = new URL(url).hostname;
    } catch {
        return null;
    }
    return SITES.find((s) => s.hosts.test(host))?.site ?? null;
}

// Contract between the popup and the injected confirm-and-insert script.
export type InjectPayload = {
    text: string;
    siteLabel: string;
    selectors: string[];
};

declare global {
    interface Window {
        __pkInject?: (payload: InjectPayload) => void;
    }
}
