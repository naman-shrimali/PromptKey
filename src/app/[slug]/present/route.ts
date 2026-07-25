import QRCode from "qrcode";
import dbConnect from "@/lib/db";
import { Prompt } from "@/lib/models";
import { renderGonePage } from "@/lib/scan-html";

export const dynamic = "force-dynamic";

// Presenter mode (SPEC §5 M4): full-screen QR for a projector or stage.
// Viewing the presenter page never consumes one-time views and never
// counts as a scan — only real readers on /{slug} do that.

const HTML_HEADERS = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow",
} as const;

const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Always dark modules on a white card, in both themes — never invert (SPEC §8).
const STYLE = `
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#faf8f3;--ink:#241f36;--mut:#6e6884;--acc:#7c5cfc;--line:#e7e2d6}
@media(prefers-color-scheme:dark){:root{--bg:#151220;--ink:#f1eefa;--mut:#9c94b8;--line:#342d4c}}
body{background:var(--bg);color:var(--ink);min-height:100vh;display:flex;flex-direction:column;
align-items:center;justify-content:center;gap:28px;padding:24px;
font:16px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.counter{position:fixed;top:20px;right:24px;font-size:15px;font-weight:700;color:var(--mut)}
.counter b{color:var(--acc);font-size:22px;font-variant-numeric:tabular-nums}
.qr{background:#fff;border-radius:28px;padding:min(4vmin,32px);
box-shadow:0 20px 60px rgba(36,31,54,.18);width:min(80vmin,640px)}
.qr svg{display:block;width:100%;height:auto}
.url{font:700 clamp(22px,4.5vmin,44px)/1.2 ui-monospace,Menlo,monospace;letter-spacing:.5px;
text-align:center;word-break:break-all}
.url span{color:var(--mut)}
.hint{color:var(--mut);font-size:14px}
`.trim();

export async function GET(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;
    await dbConnect();

    const prompt = await Prompt.findOne({ shortSlug: slug, deletedAt: null }).select(
        "shortSlug scanCount expiresAt e2e"
    );
    const gone = !prompt || (prompt.expiresAt && prompt.expiresAt <= new Date());

    const url = new URL(request.url);

    // Poll endpoint: /{slug}/present?count=1 → live scan counter (5 s).
    if (url.searchParams.get("count")) {
        return Response.json(
            { count: gone ? null : (prompt!.scanCount ?? 0) },
            { headers: { "Cache-Control": "private, no-store" } }
        );
    }

    if (gone) {
        return new Response(renderGonePage(), {
            status: prompt ? 410 : 404,
            headers: HTML_HEADERS,
        });
    }

    const origin = (process.env.NEXT_PUBLIC_APP_URL || url.origin).replace(/\/$/, "");
    const shareUrl = `${origin}/${prompt.shortSlug}`;
    const displayUrl = shareUrl.replace(/^https?:\/\//, "");

    // The audience needs the key too, but it only exists in the sharer's
    // fragment — a server page can never render a working E2E QR.
    if (prompt.e2e) {
        const body =
            `<div class="qr" style="display:flex;align-items:center;justify-content:center;aspect-ratio:1"><p style="color:#241f36;text-align:center;font-weight:600;padding:24px">🔒 Presenter mode isn't available for end-to-end encrypted texts — the QR would be missing its key. Share the full link from the create screen instead.</p></div>`;
        return new Response(
            `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Presenter · PromptKey</title><style>${STYLE}</style></head><body>${body}</body></html>`,
            { status: 200, headers: HTML_HEADERS }
        );
    }

    const qrSvg = await QRCode.toString(shareUrl, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 4,
        color: { dark: "#241f36", light: "#ffffff" },
    });

    const poll = `(function(){var el=document.getElementById('scans');
setInterval(function(){fetch(location.pathname+'?count=1',{cache:'no-store'})
.then(function(r){return r.json()})
.then(function(d){if(d.count!==null)el.textContent=d.count})
.catch(function(){})},5000)})();`;

    const html =
        `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
        `<meta name="viewport" content="width=device-width,initial-scale=1">` +
        `<meta name="robots" content="noindex,nofollow">` +
        `<title>Presenter · PromptKey</title><style>${STYLE}</style></head><body>` +
        `<p class="counter"><b id="scans">${prompt.scanCount ?? 0}</b> scans</p>` +
        `<div class="qr">${qrSvg}</div>` +
        `<p class="url"><span>${esc(displayUrl.split("/")[0])}/</span>${esc(prompt.shortSlug)}</p>` +
        `<p class="hint">Point a phone camera at the code, or type the address</p>` +
        `<script>${poll}</script>` +
        `</body></html>`;

    return new Response(html, { status: 200, headers: HTML_HEADERS });
}
