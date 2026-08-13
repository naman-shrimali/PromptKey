import type { InjectPayload } from "../utils/ai-sites";

// Injected on demand (activeTab grant) when the user asks to send a
// prompt into Claude / ChatGPT / Gemini. Shows a confirmation modal in a
// closed shadow root, then writes into the site's composer.
//
// Nothing is ever inserted without the user confirming in this modal.

const HOST_ID = "promptkey-inject-host";
const PREVIEW_LIMIT = 1200;

const CSS = `
:host{all:initial}
.backdrop{position:fixed;inset:0;z-index:2147483647;background:rgba(20,16,34,.45);
display:flex;align-items:center;justify-content:center;padding:24px;
font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
animation:pkFade .15s ease-out}
@keyframes pkFade{from{opacity:0}to{opacity:1}}
.card{background:#fff;color:#241f36;border-radius:22px;width:min(520px,100%);
max-height:80vh;display:flex;flex-direction:column;overflow:hidden;
box-shadow:0 24px 70px rgba(36,31,54,.35);animation:pkPop .18s ease-out}
@keyframes pkPop{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.backdrop,.card{animation:none}}
.head{display:flex;align-items:center;gap:10px;padding:16px 18px;border-bottom:1.5px solid #e7e2d6}
.tile{width:28px;height:28px;border-radius:9px;background:#7c5cfc;display:flex;
align-items:center;justify-content:center;font-size:14px;flex:none}
.title{font-weight:700;font-size:15px;flex:1}
.count{font-size:12px;color:#6e6884}
.body{padding:16px 18px;overflow:auto}
.label{font-size:11px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;
color:#6e6884;margin-bottom:6px}
pre{margin:0;background:#f2eee4;border-radius:12px;padding:12px;
font:400 12.5px/1.55 ui-monospace,Menlo,monospace;white-space:pre-wrap;word-break:break-word;
max-height:34vh;overflow:auto}
.note{margin-top:10px;font-size:12px;color:#6e6884}
.err{margin-top:10px;font-size:12.5px;font-weight:600;color:#c0392b;
background:#fdecea;border-radius:10px;padding:9px 12px}
.foot{display:flex;gap:8px;justify-content:flex-end;padding:14px 18px;
border-top:1.5px solid #e7e2d6;background:#faf8f3}
button{all:unset;cursor:pointer;font-weight:600;font-size:13.5px;padding:9px 18px;border-radius:12px}
.cancel{color:#6e6884;border:1.5px solid #e7e2d6;background:#fff}
.cancel:hover{border-color:#cabffa;color:#241f36}
.go{background:#7c5cfc;color:#fff;box-shadow:0 5px 16px rgba(124,92,252,.35)}
.go:active{transform:scale(.98)}
`;

/** Read whatever the editor currently holds, textarea or contenteditable. */
function readValue(el: Element): string {
    const asInput = el as HTMLTextAreaElement;
    return typeof asInput.value === "string" ? asInput.value : (el.textContent ?? "");
}

function findEditor(selectors: string[]): HTMLElement | null {
    for (const selector of selectors) {
        for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
            // Skip hidden/detached candidates — these pages keep offscreen
            // template nodes that match the same selectors.
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) return el;
        }
    }
    return null;
}

function write(el: HTMLElement, text: string): void {
    el.focus();

    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
        // React tracks the value property, so the native setter is required
        // for it to notice the change at all.
        const proto =
            el instanceof HTMLTextAreaElement
                ? HTMLTextAreaElement.prototype
                : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
        const start = el.selectionStart ?? el.value.length;
        const end = el.selectionEnd ?? el.value.length;
        const next = el.value.slice(0, start) + text + el.value.slice(end);
        if (setter) setter.call(el, next);
        else el.value = next;
        try {
            const caret = start + text.length;
            el.setSelectionRange(caret, caret);
        } catch {
            // some inputs disallow selection APIs; harmless
        }
        el.dispatchEvent(new Event("input", { bubbles: true }));
        return;
    }

    // Rich editors (ProseMirror on Claude/ChatGPT, Quill on Gemini) keep an
    // internal document model. Assigning textContent updates the DOM but not
    // that model, so the text vanishes on the next keystroke. execCommand
    // emits the beforeinput/input pair they actually listen for.
    let handled = false;
    try {
        handled = document.execCommand("insertText", false, text);
    } catch {
        handled = false;
    }
    if (handled) return;

    // Last resort: synthesize a paste, which every rich editor implements.
    try {
        const data = new DataTransfer();
        data.setData("text/plain", text);
        el.dispatchEvent(
            new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true })
        );
    } catch {
        // nothing else to try; caller verifies and reports failure
    }
}

function showModal(payload: InjectPayload) {
    document.getElementById(HOST_ID)?.remove();

    const host = document.createElement("div");
    host.id = HOST_ID;
    const root = host.attachShadow({ mode: "closed" });

    const style = document.createElement("style");
    style.textContent = CSS;
    root.appendChild(style);

    const backdrop = document.createElement("div");
    backdrop.className = "backdrop";
    const card = document.createElement("div");
    card.className = "card";
    backdrop.appendChild(card);
    root.appendChild(backdrop);

    // head
    const head = document.createElement("div");
    head.className = "head";
    const tile = document.createElement("span");
    tile.className = "tile";
    tile.textContent = "🔑";
    const title = document.createElement("span");
    title.className = "title";
    title.textContent = `Insert this prompt into ${payload.siteLabel}?`;
    const count = document.createElement("span");
    count.className = "count";
    count.textContent = `${[...payload.text].length.toLocaleString()} chars`;
    head.append(tile, title, count);
    card.appendChild(head);

    // body
    const body = document.createElement("div");
    body.className = "body";
    const label = document.createElement("p");
    label.className = "label";
    label.textContent = "Prompt";
    const pre = document.createElement("pre");
    pre.textContent =
        payload.text.length > PREVIEW_LIMIT
            ? payload.text.slice(0, PREVIEW_LIMIT) + "\n…"
            : payload.text;
    const note = document.createElement("p");
    note.className = "note";
    note.textContent =
        "It goes into the message box at your cursor. Nothing is sent — you still press enter.";
    body.append(label, pre, note);
    card.appendChild(body);

    // foot
    const foot = document.createElement("div");
    foot.className = "foot";
    const cancel = document.createElement("button");
    cancel.className = "cancel";
    cancel.textContent = "Cancel";
    const go = document.createElement("button");
    go.className = "go";
    go.textContent = `Insert into ${payload.siteLabel}`;
    foot.append(cancel, go);
    card.appendChild(foot);

    const close = () => {
        host.remove();
        document.removeEventListener("keydown", onKey, true);
    };
    const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey, true);
    cancel.addEventListener("click", close);
    backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) close();
    });

    go.addEventListener("click", async () => {
        const editor = findEditor(payload.selectors);
        if (!editor) {
            showError(
                `Couldn't find the ${payload.siteLabel} message box. Click into it once, then try again.`
            );
            return;
        }

        const before = readValue(editor);
        write(editor, payload.text);

        // Verify by observation rather than trusting the write path —
        // these editors change often and failures should be visible.
        await new Promise((r) => setTimeout(r, 60));
        if (readValue(editor) === before) {
            showError(
                `${payload.siteLabel} didn't accept the text. Copy it manually — the prompt is still in your PromptKey popup.`
            );
            return;
        }
        close();
    });

    function showError(message: string) {
        body.querySelector(".err")?.remove();
        const err = document.createElement("p");
        err.className = "err";
        err.textContent = message;
        body.appendChild(err);
        body.scrollTop = body.scrollHeight;
    }

    document.documentElement.appendChild(host);
    go.focus();
}

export default defineUnlistedScript(() => {
    window.__pkInject = showModal;
});
