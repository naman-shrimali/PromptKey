import QRCode from "qrcode";
import { createLink, fetchLibrary, fetchPromptContent, type RemoteItem } from "../../utils/api";
import { fetchRemoteHistory } from "../../utils/api";
import { addHistory, getHistory, type HistoryItem } from "../../utils/history";
import { MAX_CHARS, QR_DIRECT_DEFAULT, QR_DIRECT_MAX, utf8Bytes } from "../../utils/settings";
import { detectAiSite, type AiSite } from "../../utils/ai-sites";

type Mode = "offline" | "link";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const contentEl = $<HTMLTextAreaElement>("content");
const countEl = $("count");
const modeNoteEl = $("mode-note");
const offlineBtn = $<HTMLButtonElement>("mode-offline");
const linkBtn = $<HTMLButtonElement>("mode-link");
const linkOpts = $("link-opts");
const oneTimeBtn = $<HTMLButtonElement>("one-time");
const errorEl = $("error");
const insertBtn = $<HTMLButtonElement>("insert");
const makeBtn = $<HTMLButtonElement>("make");
const resultEl = $("result");
const qrCanvas = $<HTMLCanvasElement>("qr");
const badgeEl = $("badge");
const urlRow = $("url-row");
const urlEl = $("url");

let modeOverride: Mode | null = null;
let expiresIn = "7d";
let oneTime = false;
let lastQrValue: string | null = null;
let lastUrl: string | null = null;
// Set when the active tab is Claude / ChatGPT / Gemini.
let aiSite: AiSite | null = null;
let aiTabId: number | null = null;

function currentMode(): { mode: Mode; offlineAvailable: boolean } {
    const bytes = utf8Bytes(contentEl.value);
    const offlineAvailable = bytes > 0 && bytes <= QR_DIRECT_MAX;
    const defaultMode: Mode = bytes > 0 && bytes <= QR_DIRECT_DEFAULT ? "offline" : "link";
    const mode =
        modeOverride && (modeOverride !== "offline" || offlineAvailable)
            ? modeOverride
            : defaultMode;
    return { mode, offlineAvailable };
}

function render() {
    const chars = [...contentEl.value].length;
    countEl.textContent = `${chars.toLocaleString()} / ${MAX_CHARS.toLocaleString()}`;

    insertBtn.disabled = chars === 0;

    const { mode, offlineAvailable } = currentMode();
    offlineBtn.disabled = !offlineAvailable;
    offlineBtn.setAttribute("aria-pressed", String(mode === "offline"));
    linkBtn.setAttribute("aria-pressed", String(mode === "link"));
    linkOpts.hidden = mode !== "link";
    modeNoteEl.textContent = offlineAvailable
        ? ""
        : contentEl.value
          ? "too long for offline QR"
          : "";
}

async function make() {
    errorEl.hidden = true;
    const text = contentEl.value;
    if (text.trim().length === 0) {
        showError("Paste something first ✍️");
        return;
    }
    if ([...text].length > MAX_CHARS) {
        showError(`Too long — max ${MAX_CHARS.toLocaleString()} characters`);
        return;
    }

    const { mode } = currentMode();
    makeBtn.disabled = true;
    makeBtn.textContent = "Making…";
    try {
        if (mode === "offline") {
            await showResult(text, "📴 Offline QR — works without internet, fully private.", null);
            void addHistory({ mode, preview: text.slice(0, 60), at: new Date().toISOString() });
        } else {
            const created = await createLink(text, { expiresIn, oneTime });
            const badge = `🔗 Link QR — trackable, editable, expires ${
                created.expiresAt
                    ? new Date(created.expiresAt).toLocaleDateString()
                    : "never"
            }.`;
            await showResult(created.url, badge, created.url);
            void addHistory({
                mode,
                preview: text.slice(0, 60),
                url: created.url,
                slug: created.slug,
                at: new Date().toISOString(),
            });
        }
        void renderHistory();
    } catch (error) {
        showError(error instanceof Error ? error.message : "Something went wrong");
    } finally {
        makeBtn.disabled = false;
        makeBtn.textContent = "Regenerate ↻";
    }
}

function showError(message: string) {
    errorEl.textContent = message;
    errorEl.hidden = false;
}

async function showResult(qrValue: string, badge: string, url: string | null) {
    lastQrValue = qrValue;
    lastUrl = url;
    await QRCode.toCanvas(qrCanvas, qrValue, {
        errorCorrectionLevel: "M",
        margin: 4,
        width: 260,
        color: { dark: "#241f36", light: "#ffffff" },
    });
    badgeEl.textContent = badge;
    urlRow.hidden = !url;
    if (url) urlEl.textContent = url.replace(/^https?:\/\//, "");
    resultEl.hidden = false;
}

async function qrPngUrl(size = 1024): Promise<string> {
    return QRCode.toDataURL(lastQrValue!, {
        errorCorrectionLevel: "M",
        margin: 4,
        width: size,
        color: { dark: "#241f36", light: "#ffffff" },
    });
}

async function renderHistory() {
    const listEl = $("history");
    const section = $("history-section");
    const local = await getHistory();
    const remote = await fetchRemoteHistory(5);

    // Server history wins for link items when signed in (SPEC §5 M3);
    // offline items only ever exist locally.
    const merged: HistoryItem[] = [
        ...local.filter((h) => h.mode === "offline"),
        ...(remote
            ? remote.map((r) => ({
                  mode: "link" as const,
                  preview: r.title,
                  url: r.url,
                  slug: r.slug,
                  at: r.createdAt,
              }))
            : local.filter((h) => h.mode === "link")),
    ]
        .sort((a, b) => (a.at < b.at ? 1 : -1))
        .slice(0, 5);

    listEl.textContent = "";
    for (const item of merged) {
        const li = document.createElement("li");
        const icon = document.createElement("span");
        icon.textContent = item.mode === "offline" ? "📴" : "🔗";
        const preview = document.createElement("span");
        preview.className = "preview";
        preview.textContent = item.preview || "(untitled)";
        li.append(icon, preview);
        if (item.url) {
            const a = document.createElement("a");
            a.href = item.url;
            a.target = "_blank";
            a.rel = "noopener";
            a.textContent = "open ↗";
            li.appendChild(a);
        }
        listEl.appendChild(li);
    }
    section.hidden = merged.length === 0;
}

/**
 * If the active tab is an AI chat site, promote "insert directly" over
 * "make a QR" — going through a QR to reach a chat box on the same screen
 * would be silly.
 */
async function setupAiSite() {
    try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        const site = detectAiSite(tab?.url);
        if (!site || !tab?.id) return;
        aiSite = site;
        aiTabId = tab.id;
        insertBtn.textContent = `⚡ Insert into ${site.label}`;
        insertBtn.hidden = false;
        makeBtn.classList.add("demoted");
        makeBtn.textContent = "or make a QR instead →";
    } catch {
        // No tab access (restricted page) — the button just stays hidden.
    }
}

async function injectText(text: string) {
    if (!aiSite || aiTabId === null) return;

    const payload = { text, siteLabel: aiSite.label, selectors: aiSite.selectors };
    try {
        // Two-step in the same isolated world: load the bundle, then hand
        // it the payload. It renders its own confirmation modal — nothing
        // is written to the page until the user confirms there.
        await browser.scripting.executeScript({ target: { tabId: aiTabId }, files: ["/inject.js"] });
        await browser.scripting.executeScript({
            target: { tabId: aiTabId },
            func: (p: unknown) => {
                window.__pkInject?.(p as never);
            },
            args: [payload],
        });
        window.close(); // get out of the way so the in-page modal is visible
    } catch {
        showError("Couldn't reach that tab. Reload the page and try again.");
    }
}

async function insertIntoSite() {
    const text = contentEl.value;
    if (text.trim().length === 0) {
        showError("Paste something first ✍️");
        return;
    }
    await injectText(text);
}

// ——— Library picker ———

let libraryItems: RemoteItem[] = [];

async function renderLibrary() {
    const section = $("library-section");
    const note = $("lib-note");
    const list = $("library");

    const items = await fetchLibrary(50);
    section.hidden = false;

    if (items === null) {
        note.hidden = false;
        note.textContent =
            "Sign in on the PromptKey site, or add an API token in options, to reach your saved prompts.";
        list.textContent = "";
        return;
    }

    libraryItems = items;
    if (items.length === 0) {
        note.hidden = false;
        note.textContent = "Nothing saved yet — prompts you create while signed in show up here.";
    } else {
        note.hidden = true;
    }
    paintLibrary();
}

function paintLibrary() {
    const list = $("library");
    const query = ($<HTMLInputElement>("lib-search").value || "").trim().toLowerCase();
    const items = query
        ? libraryItems.filter((i) => (i.title ?? "").toLowerCase().includes(query))
        : libraryItems;

    list.textContent = "";
    for (const item of items) {
        const li = document.createElement("li");
        // E2E prompts have no server-side plaintext, so they can't be
        // loaded here — the key only exists in the original link.
        if (item.e2e) li.dataset.disabled = "1";

        const main = document.createElement("button");
        main.type = "button";
        main.className = "lib-main";
        const title = document.createElement("span");
        title.className = "lib-title";
        title.textContent = item.title || "(untitled)";
        const meta = document.createElement("span");
        meta.className = "lib-meta";
        meta.textContent = [
            `${(item.charCount ?? 0).toLocaleString()} chars`,
            item.e2e ? "🔒 e2e" : null,
            item.isOneTimeView ? "👁 one-time" : null,
        ]
            .filter(Boolean)
            .join(" · ");
        main.append(title, meta);
        main.title = item.e2e
            ? "End-to-end encrypted — only the original link can open this"
            : "Load into the editor";
        main.addEventListener("click", () => void loadIntoEditor(item));
        li.appendChild(main);

        if (aiSite) {
            const insert = document.createElement("button");
            insert.type = "button";
            insert.className = "lib-insert";
            insert.textContent = "⚡";
            insert.disabled = !!item.e2e;
            insert.title = item.e2e
                ? "End-to-end encrypted — can't be inserted"
                : `Insert into ${aiSite.label}`;
            insert.addEventListener("click", async () => {
                insert.disabled = true;
                insert.textContent = "…";
                try {
                    await injectText(await fetchPromptContent(item.slug));
                } catch (error) {
                    showError(error instanceof Error ? error.message : "Couldn't load that prompt");
                    insert.disabled = false;
                    insert.textContent = "⚡";
                }
            });
            li.appendChild(insert);
        }

        list.appendChild(li);
    }
}

async function loadIntoEditor(item: RemoteItem) {
    try {
        contentEl.value = await fetchPromptContent(item.slug);
        errorEl.hidden = true;
        render();
        contentEl.focus();
    } catch (error) {
        showError(error instanceof Error ? error.message : "Couldn't load that prompt");
    }
}

async function prefillFromSelection() {
    // Window-fallback path passes ?text= (restricted pages).
    const param = new URLSearchParams(location.search).get("text");
    if (param) {
        contentEl.value = param;
        render();
        return;
    }
    try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) return;
        const [{ result }] = await browser.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => window.getSelection()?.toString() ?? "",
        });
        if (result) {
            contentEl.value = result;
            render();
        }
    } catch {
        // restricted page — nothing to prefill
    }
}

// wire up
contentEl.addEventListener("input", () => {
    errorEl.hidden = true;
    render();
});
offlineBtn.addEventListener("click", () => {
    modeOverride = "offline";
    render();
});
linkBtn.addEventListener("click", () => {
    modeOverride = "link";
    render();
});
for (const btn of document.querySelectorAll<HTMLButtonElement>(".preset")) {
    if (btn.dataset.preset === expiresIn) btn.classList.add("on");
    btn.addEventListener("click", () => {
        expiresIn = btn.dataset.preset!;
        document.querySelectorAll(".preset").forEach((b) => b.classList.remove("on"));
        btn.classList.add("on");
    });
}
oneTimeBtn.addEventListener("click", () => {
    oneTime = !oneTime;
    oneTimeBtn.setAttribute("aria-pressed", String(oneTime));
});
insertBtn.addEventListener("click", insertIntoSite);
makeBtn.addEventListener("click", make);
$("copy-url").addEventListener("click", async () => {
    if (!lastUrl) return;
    await navigator.clipboard.writeText(lastUrl);
    $("copy-url").textContent = "Copied ✓";
    setTimeout(() => ($("copy-url").textContent = "Copy"), 1600);
});
$("dl-png").addEventListener("click", async () => {
    if (!lastQrValue) return;
    const a = document.createElement("a");
    a.href = await qrPngUrl();
    a.download = "promptkey-qr.png";
    a.click();
});
$("copy-img").addEventListener("click", async () => {
    if (!lastQrValue) return;
    try {
        const blob = await (await fetch(await qrPngUrl())).blob();
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        $("copy-img").textContent = "Copied ✓";
        setTimeout(() => ($("copy-img").textContent = "Copy image"), 1600);
    } catch {
        showError("Copying images isn't supported here — download instead");
    }
});
$("open-options").addEventListener("click", () => browser.runtime.openOptionsPage());

$("lib-search").addEventListener("input", paintLibrary);

render();
void (async () => {
    // Site detection first: the library rows render an insert button only
    // when we already know which AI site (if any) is in the active tab.
    await setupAiSite();
    void prefillFromSelection();
    void renderLibrary();
    void renderHistory();
})();
contentEl.focus();
