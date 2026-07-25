import QRCode from "qrcode";
import type { OverlayPayload } from "../utils/overlay-payload";

// Injected on demand via scripting.executeScript (activeTab grant).
// Renders inside a closed shadow root so page styles can't bleed in and
// ours can't leak out (SPEC §5 M3).

const HOST_ID = "promptkey-overlay-host";

// PromptKey design tokens (see web app globals.css); QR modules stay
// dark-on-white regardless of page theme (SPEC §8).
const CSS = `
:host{all:initial}
.wrap{position:fixed;top:16px;right:16px;z-index:2147483647;
font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
background:#fff;color:#241f36;border:1.5px solid #e7e2d6;border-radius:20px;
box-shadow:0 12px 40px rgba(36,31,54,.22);padding:16px;width:264px;
animation:pk-pop .18s ease-out}
@keyframes pk-pop{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.wrap{animation:none}}
.head{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.tile{width:26px;height:26px;border-radius:8px;background:#7c5cfc;display:flex;
align-items:center;justify-content:center;font-size:13px}
.name{font-weight:700;font-size:14px;flex:1}
.close{all:unset;cursor:pointer;font-size:15px;color:#6e6884;padding:2px 6px;border-radius:6px}
.close:hover{background:#f2eee4}
canvas{display:block;width:100%!important;height:auto!important;border-radius:12px}
.badge{margin-top:10px;font-size:11.5px;font-weight:600;color:#241f36;
background:#f1edfe;border:1.5px solid #cabffa;border-radius:10px;padding:6px 10px}
.url{margin-top:8px;display:flex;gap:6px;align-items:center}
.url code{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
font:600 11.5px ui-monospace,Menlo,monospace;background:#f2eee4;border-radius:8px;padding:6px 8px}
.copy{all:unset;cursor:pointer;background:#7c5cfc;color:#fff;font-weight:600;font-size:11.5px;
padding:6px 12px;border-radius:8px}
.copy:active{transform:scale(.97)}
.err{font-size:13px;font-weight:600;padding:4px 2px}
`;

function showOverlay(payload: OverlayPayload) {
    document.getElementById(HOST_ID)?.remove();

    const host = document.createElement("div");
    host.id = HOST_ID;
    const root = host.attachShadow({ mode: "closed" });

    const style = document.createElement("style");
    style.textContent = CSS;
    root.appendChild(style);

    const wrap = document.createElement("div");
    wrap.className = "wrap";
    root.appendChild(wrap);

    const head = document.createElement("div");
    head.className = "head";
    const tile = document.createElement("span");
    tile.className = "tile";
    tile.textContent = "🔑";
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = "PromptKey";
    const close = document.createElement("button");
    close.className = "close";
    close.textContent = "✕";
    close.setAttribute("aria-label", "Close");
    head.append(tile, name, close);
    wrap.appendChild(head);

    const dismiss = () => {
        host.remove();
        document.removeEventListener("keydown", onKey, true);
    };
    const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") dismiss();
    };
    close.addEventListener("click", dismiss);
    document.addEventListener("keydown", onKey, true);

    if (payload.kind === "error") {
        const err = document.createElement("p");
        err.className = "err";
        err.textContent = payload.message;
        wrap.appendChild(err);
    } else {
        const canvas = document.createElement("canvas");
        wrap.appendChild(canvas);
        // qrcode encodes UTF-8 byte mode natively — emoji/RTL/CJK survive.
        QRCode.toCanvas(canvas, payload.qrValue, {
            errorCorrectionLevel: "M",
            margin: 4,
            width: 232,
            color: { dark: "#241f36", light: "#ffffff" },
        }).catch(() => {
            dismiss();
        });

        const badge = document.createElement("p");
        badge.className = "badge";
        badge.textContent = payload.badge;
        wrap.appendChild(badge);

        if (payload.url) {
            const row = document.createElement("div");
            row.className = "url";
            const code = document.createElement("code");
            code.textContent = payload.url.replace(/^https?:\/\//, "");
            const copy = document.createElement("button");
            copy.className = "copy";
            copy.textContent = "Copy";
            copy.addEventListener("click", async () => {
                try {
                    await navigator.clipboard.writeText(payload.url!);
                    copy.textContent = "Copied ✓";
                    setTimeout(() => (copy.textContent = "Copy"), 1600);
                } catch {
                    copy.textContent = "Copy failed";
                }
            });
            row.append(code, copy);
            wrap.appendChild(row);
        }
    }

    document.documentElement.appendChild(host);
}

export default defineUnlistedScript(() => {
    window.__pkShowOverlay = showOverlay;
});
