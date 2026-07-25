import { createLink } from "../utils/api";
import { addHistory } from "../utils/history";
import { QR_DIRECT_MAX, utf8Bytes } from "../utils/settings";
import type { OverlayPayload } from "../utils/overlay-payload";

const MENU_ID = "pk-qr-selection";

export default defineBackground(() => {
    browser.runtime.onInstalled.addListener(() => {
        browser.contextMenus.create({
            id: MENU_ID,
            title: "PromptKey: QR for selection",
            contexts: ["selection"],
        });
    });

    browser.contextMenus.onClicked.addListener((info, tab) => {
        if (info.menuItemId !== MENU_ID || !tab?.id) return;
        void handleSelection(tab.id);
    });

    // Ctrl/Cmd+Shift+Q (SPEC §5 M3)
    browser.commands.onCommand.addListener(async (command, tab) => {
        if (command !== "qr-selection") return;
        const tabId =
            tab?.id ??
            (await browser.tabs.query({ active: true, currentWindow: true }))[0]?.id;
        if (tabId) void handleSelection(tabId);
    });
});

async function handleSelection(tabId: number) {
    let text: string;
    try {
        // Read the live selection instead of info.selectionText — Chrome
        // collapses newlines in selectionText, and whitespace fidelity is
        // a product requirement (SPEC §8).
        const [{ result }] = await browser.scripting.executeScript({
            target: { tabId },
            func: () => window.getSelection()?.toString() ?? "",
        });
        text = result ?? "";
    } catch {
        // Restricted page (chrome://, web store, …): scripts can't run —
        // fall back to opening the popup (SPEC §8).
        await openPopupWindow("");
        return;
    }

    const payload = await buildPayload(text);
    try {
        await showOverlay(tabId, payload);
    } catch {
        await openPopupWindow(text);
    }
}

async function buildPayload(text: string): Promise<OverlayPayload> {
    if (text.trim().length === 0) {
        return { kind: "error", message: "Select some text first, then try again ✍️" };
    }

    // Offline mode whenever it fits (SPEC §5 M3): the QR is generated
    // in-page with zero network involved.
    if (utf8Bytes(text) <= QR_DIRECT_MAX) {
        void addHistory({ mode: "offline", preview: text.slice(0, 60), at: new Date().toISOString() });
        return {
            kind: "qr",
            mode: "offline",
            qrValue: text,
            badge: "📴 Offline QR — works without internet, fully private.",
        };
    }

    try {
        const created = await createLink(text, { expiresIn: "7d" });
        void addHistory({
            mode: "link",
            preview: text.slice(0, 60),
            url: created.url,
            slug: created.slug,
            at: new Date().toISOString(),
        });
        return {
            kind: "qr",
            mode: "link",
            qrValue: created.url,
            url: created.url,
            badge: "🔗 Link QR — the text is too long to fit in a QR, so this points to a short link.",
        };
    } catch (error) {
        return {
            kind: "error",
            message:
                error instanceof Error
                    ? `Couldn't create a link: ${error.message}`
                    : "Couldn't create a link — check the PromptKey options.",
        };
    }
}

async function showOverlay(tabId: number, payload: OverlayPayload) {
    // Two-step injection in the same isolated world: load the overlay
    // bundle (defines window.__pkShowOverlay), then hand it the payload.
    await browser.scripting.executeScript({ target: { tabId }, files: ["/overlay.js"] });
    await browser.scripting.executeScript({
        target: { tabId },
        func: (p: unknown) => {
            window.__pkShowOverlay?.(p as never);
        },
        args: [payload],
    });
}

async function openPopupWindow(text: string) {
    const url =
        browser.runtime.getURL("/popup.html") +
        (text ? `?text=${encodeURIComponent(text.slice(0, 8000))}` : "");
    await browser.windows.create({ url, type: "popup", width: 420, height: 640 });
}
