// Hand-rolled HTML for the scan page (SPEC §5.2): performance is the
// feature. Serving this from a route handler ships ZERO framework
// JavaScript — the only scripts are a ~200-byte theme snippet and the
// copy button handler. It also lets us return honest 404/410 statuses.
//
// Content is inserted exclusively through esc() — plaintext is never
// interpreted as HTML (SPEC §7: that is the XSS defense).

import { VARIABLE_PATTERN } from "./variables";

const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Design tokens from PromptKey Standalone.html (see globals.css).
const STYLE = `
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#faf8f3;--card:#fff;--ink:#241f36;--mut:#6e6884;--line:#e7e2d6;--soft:#f2eee4;--acc:#7c5cfc;
--acc-soft:color-mix(in srgb,var(--acc) 11%,#fff);--acc-line:color-mix(in srgb,var(--acc) 40%,var(--line))}
html.dark{--bg:#151220;--card:#201b31;--ink:#f1eefa;--mut:#9c94b8;--line:#342d4c;--soft:#272138;
--acc-soft:color-mix(in srgb,var(--acc) 16%,#201b31);--acc-line:color-mix(in srgb,var(--acc) 45%,var(--line))}
@media(prefers-color-scheme:dark){html:not(.light){--bg:#151220;--card:#201b31;--ink:#f1eefa;--mut:#9c94b8;
--line:#342d4c;--soft:#272138;--acc-soft:color-mix(in srgb,var(--acc) 16%,#201b31);--acc-line:color-mix(in srgb,var(--acc) 45%,var(--line))}}
body{background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
-webkit-font-smoothing:antialiased;min-height:100vh;display:flex;flex-direction:column}
.wrap{width:100%;max-width:640px;margin:0 auto;padding:20px 20px 16px;display:flex;flex-direction:column;flex:1}
.brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--ink);margin-bottom:18px;width:fit-content}
.brand .tile{width:36px;height:36px;border-radius:12px;background:var(--acc);display:flex;align-items:center;
justify-content:center;font-size:17px;box-shadow:0 4px 14px color-mix(in srgb,var(--acc) 35%,transparent)}
.brand b{font-size:19px;letter-spacing:.2px}
.card{background:var(--card);border:1.5px solid var(--line);border-radius:22px;overflow:hidden}
.strip{display:flex;align-items:center;gap:8px;padding:13px 20px;border-bottom:1.5px solid var(--line);background:var(--soft)}
.strip .slug{font:600 14px ui-monospace,Menlo,monospace}
.strip .meta{margin-left:auto;font-size:12.5px;color:var(--mut);text-align:right}
.body{padding:18px}
.once{border:1.5px solid var(--acc-line);background:var(--acc-soft);border-radius:12px;
padding:10px 14px;font-size:13px;font-weight:600;margin-bottom:12px}
pre{background:var(--soft);border-radius:14px;padding:16px;font:400 13.5px/1.6 ui-monospace,Menlo,monospace;
white-space:pre-wrap;word-break:break-word;max-height:56vh;overflow:auto}
.foot{position:sticky;bottom:0;padding:14px 0 6px;margin-top:14px;
background:linear-gradient(to top,var(--bg) 70%,transparent)}
#copy{display:block;width:100%;min-height:56px;border:0;border-radius:16px;background:var(--acc);color:#fff;
font:600 17px inherit;font-family:inherit;cursor:pointer;
box-shadow:0 6px 18px color-mix(in srgb,var(--acc) 35%,transparent);transition:transform .15s}
#copy:active{transform:scale(.98)}
.row{display:flex;justify-content:center;gap:8px;margin-top:12px;flex-wrap:wrap}
.pill{border:1.5px solid var(--line);background:var(--card);color:var(--mut);text-decoration:none;
font-size:12.5px;font-weight:600;padding:6px 14px;border-radius:99px}
.pill:hover{border-color:var(--acc-line);color:var(--ink)}
.note{text-align:center;font-size:12px;color:var(--mut);margin-top:10px}
#pk-vars{margin-top:12px;display:flex;flex-direction:column;gap:8px}
#pk-vars .vars-h{font-size:12px;font-weight:700;color:var(--mut)}
#pk-vars label{display:flex;align-items:center;gap:8px}
#pk-vars label span{font:600 12px ui-monospace,Menlo,monospace;color:var(--acc);min-width:90px;
overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#pk-vars input{flex:1;min-width:0;background:var(--card);color:var(--ink);border:1.5px solid var(--line);
border-radius:10px;padding:8px 10px;font:13px inherit;font-family:inherit;outline:none}
#pk-vars input:focus{border-color:var(--acc-line)}
.e2e-err{border:1.5px solid var(--acc-line);background:var(--acc-soft);border-radius:12px;
padding:10px 14px;font-size:13px;font-weight:600;margin-top:12px}
#copy:disabled{opacity:.5;cursor:not-allowed}
.gone{margin:auto;text-align:center;padding:48px 28px}
.gone .emo{font-size:48px}
.gone h1{font-size:24px;margin-top:14px}
.gone p{color:var(--mut);font-size:14px;max-width:24rem;margin:8px auto 0}
.gone a.cta{display:inline-block;margin-top:26px;background:var(--acc);color:#fff;text-decoration:none;
font-weight:600;font-size:15px;padding:14px 30px;border-radius:16px;
box-shadow:0 6px 18px color-mix(in srgb,var(--acc) 35%,transparent)}
@media(prefers-reduced-motion:reduce){#copy{transition:none}}
`.trim();

const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');
if(t==='dark')document.documentElement.classList.add('dark');
else if(t==='light')document.documentElement.classList.add('light');}catch(e){}})();`;

const COPY_SCRIPT = `(function(){
var b=document.getElementById('copy'),p=document.getElementById('pk-content');
if(!b||!p)return;
var d=b.textContent,t;
function done(ok){
b.textContent=ok?'Copied \\u2713':'Copy failed \\u2014 press and hold the text to copy';
clearTimeout(t);t=setTimeout(function(){b.textContent=d},2000);}
function fallback(txt){
var a=document.createElement('textarea');a.value=txt;
a.style.cssText='position:fixed;opacity:0';document.body.appendChild(a);
a.focus();a.select();var ok=false;try{ok=document.execCommand('copy')}catch(e){}
document.body.removeChild(a);done(ok);}
b.addEventListener('click',function(){
var txt=p.textContent||'';
if(navigator.clipboard&&window.isSecureContext){
navigator.clipboard.writeText(txt).then(function(){done(true)},function(){fallback(txt)});
}else{fallback(txt)}
});
})();`;

// Prompt variables (SPEC §5 M4): {{name}} placeholders become inputs;
// the <pre> is live-filled so the copy button grabs the filled text.
// Defines window.__pkInit(text) — called inline (plain pages) or after
// decryption (E2E pages).
const VARIABLES_SCRIPT = `(function(){
var pre=document.getElementById('pk-content'),box=document.getElementById('pk-vars');
if(!pre||!box)return;
var RE=new RegExp(${JSON.stringify(VARIABLE_PATTERN)},'g');
window.__pkInit=function(tpl){
var names=[],m,re=new RegExp(RE.source,'g');
while((m=re.exec(tpl))){if(names.indexOf(m[1])<0)names.push(m[1])}
if(!names.length){box.hidden=true;return}
var vals={};box.textContent='';box.hidden=false;
var h=document.createElement('p');h.className='vars-h';
h.textContent='\\u270F\\uFE0F Fill in the blanks \\u2014 Copy uses your values';
box.appendChild(h);
function refill(){
pre.textContent=tpl.replace(new RegExp(RE.source,'g'),function(all,name){
return vals[name]?vals[name]:all});}
names.forEach(function(n){
var l=document.createElement('label'),s=document.createElement('span'),
i=document.createElement('input');
s.textContent=n;i.placeholder=n;
i.addEventListener('input',function(){vals[n]=i.value;refill()});
l.appendChild(s);l.appendChild(i);box.appendChild(l)});
};
})();`;

// E2E decryption (SPEC §5 M4): the key never reached the server — it
// lives in the fragment. WebCrypto AES-GCM, in the reader's browser.
const E2E_SCRIPT = `(async function(){
var pre=document.getElementById('pk-content'),el=document.getElementById('pk-e2e'),
err=document.getElementById('pk-e2e-err'),copyBtn=document.getElementById('copy');
if(!pre||!el)return;
function b64u(s){s=s.replace(/-/g,'+').replace(/_/g,'/');var bin=atob(s);
var a=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return a}
function fail(msg){pre.textContent='\\u2022\\u2022\\u2022';err.textContent=msg;err.hidden=false;
if(copyBtn)copyBtn.disabled=true}
var m=(location.hash||'').match(/[#&]k=([A-Za-z0-9_-]+)/);
if(!m){fail('\\uD83D\\uDD11 This link is missing its key \\u2014 ask for the complete link, everything after the # matters.');return}
try{
var key=await crypto.subtle.importKey('raw',b64u(m[1]),{name:'AES-GCM'},false,['decrypt']);
var plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64u(el.dataset.iv)},key,b64u(el.dataset.ct));
var text=new TextDecoder().decode(plain);
pre.textContent=text;
if(window.__pkInit)window.__pkInit(text);
}catch(e){fail('\\uD83D\\uDD12 Couldn\\u2019t decrypt \\u2014 the key in this link doesn\\u2019t match this text.')}
})();`;

// OG tags never describe the content (SPEC §5.2).
function page(title: string, body: string): string {
    return (
        `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
        `<meta name="viewport" content="width=device-width,initial-scale=1">` +
        `<meta name="robots" content="noindex,nofollow">` +
        `<meta property="og:title" content="Someone shared text with you via PromptKey">` +
        `<meta property="og:description" content="Tap to view and copy it.">` +
        `<title>${esc(title)}</title>` +
        `<script>${THEME_SCRIPT}</script>` +
        `<style>${STYLE}</style>` +
        `</head><body><div class="wrap">` +
        `<a class="brand" href="/"><span class="tile">🔑</span><b>PromptKey</b></a>` +
        body +
        `</div></body></html>`
    );
}

const DATE_FMT = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" });

type ScanShell = {
    slug: string;
    charCount: number;
    createdAt: Date;
    isOneTimeView: boolean;
    icon: string;
    preInner: string; // already escaped / safe
    afterPre?: string;
    showRawLink: boolean;
    footNote: string;
    scripts: string[];
};

function scanBody(opts: ScanShell): string {
    return (
        `<main class="card">` +
        `<div class="strip"><span aria-hidden="true">${opts.icon}</span>` +
        `<span class="slug">/${esc(opts.slug)}</span>` +
        `<span class="meta">${opts.charCount.toLocaleString("en")} chars · ${DATE_FMT.format(opts.createdAt)}</span></div>` +
        `<div class="body">` +
        (opts.isOneTimeView
            ? `<p class="once">👁 One-time view — this text disappears when you leave. Copy it now.</p>`
            : ``) +
        `<pre id="pk-content">${opts.preInner}</pre>` +
        (opts.afterPre ?? "") +
        `<div id="pk-vars" hidden></div>` +
        `</div></main>` +
        `<div class="foot">` +
        `<button id="copy" type="button" aria-live="polite">Copy all 📋</button>` +
        `<div class="row">` +
        (opts.showRawLink ? `<a class="pill" href="/${esc(opts.slug)}/raw">Open raw ↗</a>` : ``) +
        `<a class="pill" href="/">Make your own QR →</a>` +
        `</div>` +
        `<p class="note">${opts.footNote}</p>` +
        `</div>` +
        opts.scripts.map((s) => `<script>${s}</script>`).join("")
    );
}

export function renderScanPage(opts: {
    slug: string;
    content: string;
    charCount: number;
    createdAt: Date;
    isOneTimeView: boolean;
}): string {
    const body = scanBody({
        slug: opts.slug,
        charCount: opts.charCount,
        createdAt: opts.createdAt,
        isOneTimeView: opts.isOneTimeView,
        icon: opts.isOneTimeView ? "👁" : "🔓",
        preInner: esc(opts.content),
        showRawLink: !opts.isOneTimeView,
        footNote: "🔒 Decrypted server-side, delivered over HTTPS. PromptKey never trains on your text.",
        scripts: [
            VARIABLES_SCRIPT,
            // template = the server-rendered text itself
            `window.__pkInit&&window.__pkInit(document.getElementById('pk-content').textContent);`,
            COPY_SCRIPT,
        ],
    });
    return page("Someone shared text with you · PromptKey", body);
}

// E2E scan page (SPEC §5 M4): ships the ciphertext + a decryptor; the
// key arrives in the fragment and never in a request.
export function renderE2eScanPage(opts: {
    slug: string;
    ciphertext: string; // b64url as stored
    iv: string; // b64url
    charCount: number;
    createdAt: Date;
    isOneTimeView: boolean;
}): string {
    const body = scanBody({
        slug: opts.slug,
        charCount: opts.charCount,
        createdAt: opts.createdAt,
        isOneTimeView: opts.isOneTimeView,
        icon: "🔒",
        preInner: "Decrypting in your browser…",
        afterPre:
            `<div id="pk-e2e" hidden data-ct="${esc(opts.ciphertext)}" data-iv="${esc(opts.iv)}"></div>` +
            `<p id="pk-e2e-err" class="e2e-err" hidden></p>`,
        showRawLink: false, // no /raw for E2E (SPEC §5 M4)
        footNote: "🔒 End-to-end encrypted — decrypted in your browser. The key never reached our servers.",
        scripts: [VARIABLES_SCRIPT, E2E_SCRIPT, COPY_SCRIPT],
    });
    return page("Someone shared text with you · PromptKey", body);
}

// One honest page for every failure mode — no enumeration hints (SPEC §8).
export function renderGonePage(): string {
    const body =
        `<main class="card gone">` +
        `<div class="emo" aria-hidden="true">🍂</div>` +
        `<h1>This text is gone</h1>` +
        `<p>The link doesn't exist, has expired, or was a one-time view that's already been read. ` +
        `That's the whole story — we can't bring it back.</p>` +
        `<a class="cta" href="/">Create your own →</a>` +
        `</main>`;
    return page("This text is gone · PromptKey", body);
}
