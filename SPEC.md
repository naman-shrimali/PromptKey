# PromptKey — Product Specification

**Version:** 1.0 · **Date:** 2026-07-11 · **Audience:** Claude Code (implementation handoff)

---

## 1. Product Definition

PromptKey moves text across gaps that copy-paste can't cross: laptop → phone, one person's screen → another person's device, slide → audience, print → device. QR codes are the transport; the product is a **cross-device text bridge with prompt-manager features**.

**Primary use cases (in priority order):**

1. Move an AI prompt from desktop browser to phone (or vice versa) in seconds, no login.
2. Share a prompt/snippet with another person's device (cross-ecosystem, no AirDrop/account needed).
3. One-to-many sharing: presenter → audience, teacher → classroom, printed poster → readers.
4. Manage a personal library of prompts with stable, editable QR codes.
5. Buy expert, model-tuned prompts from a curated marketplace (subscription or per-prompt, via Razorpay).

**One-line positioning:** "The fastest way to move text from one screen to another."

**Deliverables:** (a) Next.js web app, (b) Manifest V3 browser extension. No native mobile app — phone cameras scan natively and the scan page is mobile-first web.

---

## 2. Existing Codebase — Verdict

The repo already contains a working skeleton. **Keep the foundation. Refactor the flagged items. Do not rewrite from scratch.**

### Keep as-is
- Stack: Next.js 16 (App Router), TypeScript, Tailwind 4, shadcn/ui, Mongoose/MongoDB Atlas, `react-qr-code`, sonner, next-themes.
- `src/auth.ts` — NextAuth v5 + Google + MongoDB adapter. Extend, don't replace.
- `src/lib/models.ts` — Prompt/User/RateLimit schemas. Extend per §4.
- Route structure: `(marketing)`, `(auth)`, `(dashboard)`, `[slug]`.
- Rate limiting via TTL collection in `src/app/actions.ts` (works; refine limits per §7).

### Refactor (required, milestone M0)
- **`src/lib/encryption.ts`:** AES-256-CBC has no integrity check. Switch to **AES-256-GCM** with auth tag stored alongside `iv`. Derive the key with `crypto.hkdfSync` from `ENCRYPTION_KEY` (don't use the raw env string as key material). Write a one-off migration script for existing records (or wipe dev data — acceptable, this is pre-launch).
- **`src/app/[slug]/page.tsx`:**
  - Remove all `console.log` debug lines (they leak IVs and ciphertext prefixes).
  - One-time-view has a read-then-increment race: two simultaneous scans both pass. Use an atomic `findOneAndUpdate({ slug, scanCount: 0 }, { $inc: { scanCount: 1 } })` gate for one-time views.
  - Scan count increments on every SSR render, so link previews/prefetchers inflate it. Move the increment to a fire-and-forget call using `after()` from `next/server`, skip known bot user-agents.
  - Rebuild the UI per §5.2 (this page is the product's reputation).
- **`src/app/actions.ts`:** rate limiter has a check-then-increment race; use a single atomic `findOneAndUpdate` with upsert. Return the created record's expiry info to the client.

### Scrap
- Placeholder settings pages: `settings/notifications`, `settings/privacy`, `settings/contact`, `settings/help`, `settings/change-password`, `settings/linked-accounts`. Keep a single `settings/` page (profile + API token + delete account). OAuth users have no password to change.
- `check-db.js` (root debug script).

---

## 3. System Overview

```
apps (single repo)
├── (root)              Next.js app — marketing, create flow, scan page, dashboard, API
└── extension/          MV3 extension (separate package.json, built with WXT)
```

- The web app is the single backend. The extension talks to it via the public JSON API (§6).
- No monorepo tooling needed. `extension/` is a sibling folder with its own build.
- Two QR modes exist everywhere (web + extension): **Link mode** (QR → short URL → server) and **Offline mode** (text encoded directly in the QR, never touches the server). See §5.1.

---

## 4. Data Model (Mongoose)

Extend the existing `Prompt` schema. Fields marked ★ are new.

```
Prompt {
  shortSlug      string, unique, indexed          // nanoid(8), alphabet without ambiguous chars (no 0/O/1/l/I)
  encryptedContent string                          // AES-256-GCM ciphertext (server-encrypted mode)
  iv             string
  authTag        string ★
  contentHash    string ★  // sha256 of plaintext, indexed with ownerUserId — dedup (§8)
  title          string ★  // first 60 chars of plaintext, stored plaintext for dashboard lists
  charCount      number ★
  ownerUserId    ObjectId | null
  isGuest        boolean
  claimToken     string | null ★  // random token returned to guest creators; used for guest→account claim
  e2e            boolean ★        // M4: content is client-encrypted; server never sees plaintext
  scanCount      number
  lastScanAt     Date
  expiresAt      Date | null ★    // top-level, with TTL index { expireAfterSeconds: 0 }
  isOneTimeView  boolean          // promote out of `options`
  isFavorite     boolean ★
  tags           [string] ★
  versions       [{ encryptedContent, iv, authTag, editedAt }] ★  // last 10, for living QRs
  deletedAt      Date | null ★    // soft delete; hard-delete via TTL after 30 days
  timestamps (createdAt, updatedAt)
}
```

`User`: keep; add `apiToken` (hashed, for extension auth fallback) and `tier` (`free` for now).

`RateLimit`: keep as-is.

### Marketplace collections (M5, all new)

```
CatalogPrompt {                       // one sellable prompt (curated in-house)
  slug           string, unique       // human-readable, e.g. "cold-email-writer"
  title, description, category        // category: writing / coding / marketing / research / ...
  previewText    string               // free teaser shown to everyone (~200 chars + sample output)
  variants: [{                        // the paid content — one per target model
    model        string               // "claude", "gpt", "gemini", "llama", "generic"
    modelLabel   string               // display name, e.g. "Claude Sonnet 4.5"
    content      string               // encrypted at rest (same GCM helper)
    iv, authTag  string
  }]
  priceINR       number               // per-prompt price in paise
  ratingAvg      number, ratingCount number
  isPublished    boolean, publishedAt Date
  timestamps
}

Purchase {                            // permanent per-prompt access
  userId, catalogPromptId, razorpayOrderId, razorpayPaymentId
  amountINR      number               // paise, as charged
  status         "created" | "paid" | "failed" | "refunded"
  timestamps     // unique index (userId, catalogPromptId) where status="paid"
}

Subscription {
  userId (unique among status="active"), razorpaySubscriptionId
  plan           "weekly" | "monthly"
  status         "created" | "active" | "past_due" | "cancelled" | "expired"
  currentPeriodEnd Date
  timestamps
}

Rating { userId, catalogPromptId, stars 1–5, comment?, timestamps }
  // unique (userId, catalogPromptId); only users with access may rate

WebhookEvent { razorpayEventId unique, type, processedAt }   // idempotency guard
```

---

## 5. Feature Specification

### M0 — Hardening (do first)

All items under "Refactor" and "Scrap" in §2. Plus: add `SPEC.md`-driven config constants to a single `src/lib/config.ts`:

```
MAX_CHARS = 50_000            // absolute input limit
QR_DIRECT_MAX = 1_000         // offline mode available at or below this
QR_DIRECT_DEFAULT = 500       // offline mode is the default at or below this
GUEST_DAILY_LIMIT = 20        // creations per IP per day
GUEST_MAX_TTL_DAYS = 30
SLUG_LENGTH = 8
```

**Acceptance:** existing create → scan → copy flow still works end-to-end; no console.log in production paths; GCM round-trip unit test passes; one-time view survives a concurrent-scan test.

### M1 — Core Loop (web app)

#### 5.1 Create flow (`/`, guest-first)

- Single textarea, autofocused, with live char count. Options row: expiration preset (**1 h / 24 h / 7 d / 30 d / Never**†), one-time view toggle. †"Never" requires login; guests capped at 30 d — show a subtle "sign in to make permanent" hint, not a wall.
- **Hybrid encoding — the key differentiator:**
  - ≤ `QR_DIRECT_DEFAULT` chars → default to **Offline mode**: text encoded directly in the QR (error correction M). Nothing is sent to the server. Badge: "Offline QR — works without internet, can't expire, fully private."
  - ≤ `QR_DIRECT_MAX` → Offline available via toggle, Link mode default above `QR_DIRECT_DEFAULT`.
  - > `QR_DIRECT_MAX` → **Link mode** only: server action creates record, QR encodes `https://{domain}/{slug}`. Badge: "Link QR — trackable, editable, expires {when}."
  - The mode toggle must show *why* a mode is unavailable ("too long for offline QR").
- Result panel: large QR, the short URL with copy button, download **SVG** and **PNG (1024px)**, "copy image" (Clipboard API), and — for link mode — the expiry and a **claim notice for guests**: "Sign in to keep, edit, and track this QR." Store `{ slug, claimToken }` in `localStorage` for later claiming.
- Validation: reject empty; enforce `MAX_CHARS`; strip control characters only. Content-based rejection (script tags etc.) is **not** needed — content is never rendered as HTML (§7 security).

#### 5.2 Scan page (`/{slug}`) — performance is the feature

- Server component; target **< 30 KB HTML, zero client-side framework hydration** except a tiny inline script for the copy button. LCP < 1 s on fast 4G.
- Layout, top to bottom: char count + created date (muted), the text in a monospace-friendly, `white-space: pre-wrap` block, and a **sticky full-width Copy button** (min 56 px tall) that is thumb-reachable. Success state on the button itself ("Copied ✓").
- Secondary actions in a small row: "Open raw" (`/{slug}/raw` — `text/plain` response, curl-able) and "Make your own QR" (top-of-funnel).
- Expired / one-time-already-viewed / unknown slug → single "gone" page: honest message + "Create your own" CTA. Return proper 404/410 status codes.
- **No Open Graph description of content by default** (content is private). OG tags say only "Someone shared text with you via PromptKey". Owners can opt in to a title preview later (M2 setting per-prompt).
- Cache: `Cache-Control: private, no-store` (content may be edited or expire; correctness over CDN caching for now).

**M1 acceptance:** Lighthouse perf ≥ 95 on `/{slug}` mobile; offline-mode QR scans correctly from a phone camera at 320 px on-screen size; a 40 K-char text creates a link QR that resolves and copies correctly including emoji, RTL text, and code with preserved indentation.

### M2 — Accounts, Dashboard, Living QRs

- **Auth:** Google OAuth (exists) + **email magic link** (Resend, via NextAuth email provider). No phone OTP — cut permanently.
- **Guest → account claim:** on first login, read `localStorage` claim list, POST to `/api/claim` with `{slug, claimToken}[]`, attach `ownerUserId`, clear tokens. Show "We saved N QR codes you made earlier" toast.
- **Dashboard (`/dashboard`):** list (not grid) of prompts: title, char count, mode badge, scan count, created/edited date, favorite star, tag chips. Search (title, server-side regex on `title` only), filter by tag/favorite. Row actions: copy text, copy URL, download QR, edit, delete (soft), favorite.
- **Living QRs (edit):** editing a link-mode prompt **keeps the same slug** — the printed/shared QR keeps working with new content. Push previous content onto `versions` (cap 10). Show "edited N times · QR unchanged" in UI. Offer version restore. This is a headline feature — surface it in marketing copy.
- **Settings:** profile, generate/revoke API token (show once), delete account (soft-deletes all prompts, hard purge after 30 days).

**M2 acceptance:** guest creates 2 QRs → signs in → both appear in dashboard; editing a prompt does not change its URL and a rescan shows new content; magic-link login works end-to-end.

### M3 — Browser Extension (MV3, build with WXT)

Target Chrome + Edge + Firefox from one codebase. The extension is a **capture tool**; management lives in the web app.

- **Context menu:** select text on any page → right-click → "PromptKey: QR for selection" → an in-page overlay (shadow DOM, no style bleed) shows the QR instantly. Offline mode when ≤ limits (works with zero network); link mode otherwise (calls API).
- **Popup (toolbar click):** textarea (pre-filled with current selection if any), same mode logic and options as web create flow, QR result with copy/download. Below: last 5 items (from `chrome.storage.local`; merged with server history when authenticated).
- **Keyboard shortcut:** `Ctrl/Cmd+Shift+Q` → QR for current selection (same overlay).
- **Auth:** reuse web session cookie via `credentials: include` against the API where possible; fallback: paste API token into extension options page. Unauthenticated extension use = guest link creation (rate-limited) + offline mode.
- **Permissions:** `contextMenus`, `activeTab`, `storage`, `scripting` only. No `<all_urls>` host permission — inject overlay via `activeTab` grant.

**M3 acceptance:** select → shortcut → scannable QR on screen in < 1 s with network disabled (offline mode); link mode from popup lands in dashboard history when logged in.

### M4 — Differentiators

- **E2E encrypted mode** (create-flow toggle, "Private — even we can't read it"): client generates AES-GCM key, encrypts in-browser, uploads ciphertext (`e2e: true`), key goes in the URL **fragment** (`/{slug}#k=...`) which never reaches the server. Scan page detects `e2e`, decrypts client-side (this page may hydrate JS — perf budget exception). No `/raw`, no OG title, no server-side search on these. QR encodes the full URL including fragment.
- **Prompt variables:** detect `{{variable}}` in content; scan page renders inputs for each variable above the copy button; Copy copies the filled text. Zero config by the author.
- **Presenter mode:** full-screen QR route (`/{slug}/present`) — max-size QR, short URL in large type, live scan counter (poll every 5 s). Dark-safe: always dark modules on white card regardless of theme (§8).
- **Analytics (per prompt, owners):** scans over time (daily buckets), device class (mobile/desktop from UA, no fingerprinting), referrer. A `ScanEvent` collection `{ promptId, at, deviceClass, referrer }` with 90-day TTL.

### M5 — Prompt Marketplace (curated, Razorpay)

A catalog of in-house, expert-written prompts, each maintained as **variants tuned per target model** (Claude, GPT, Gemini, Llama, generic). Two ways to get access; both require login.

#### Access model

- **Subscription (weekly or monthly):** unlocks the *entire* catalog while active. Access checked at read time: `subscription.status === "active" && currentPeriodEnd > now` (allow a 3-day grace on `past_due`).
- **Per-prompt purchase:** one-time payment → permanent access to that catalog prompt (all its variants, including future variant updates). Survives subscription lapse.
- Plan prices and per-prompt default price live in `config.ts` (`SUB_WEEKLY_INR`, `SUB_MONTHLY_INR`, `PROMPT_DEFAULT_INR`) — amounts in paise; UI renders INR. `CatalogPrompt.priceINR` can override per item.

#### Storefront (`/market`)

- Public browse: grid of cards — title, category, rating stars, price, model badges for available variants. Filter by category/model; sort by rating (default), newest, price. Detail page (`/market/{slug}`): full description, `previewText` teaser with sample output, ratings, and a **locked** variant panel.
- **Paywall rule (server-enforced):** full variant content is returned only to users with access. List/detail endpoints for non-buyers must never include variant content — not even in the HTML payload behind CSS. Preview only.
- Unlocked view: tabbed variant switcher (one tab per model), copy button per variant, **"Send to phone" → generates a PromptKey QR** for the chosen variant (creates a normal link-mode Prompt owned by the user, `expiresAt` 24 h default). This is the synergy moment — the core product delivers the purchase.
- Unlocked prompts also get "Save to my library": copies the variant into the user's dashboard as a regular editable Prompt.
- **Ratings:** only users with access can rate (1–5 stars, optional short comment). One rating per user per prompt, editable. Recompute `ratingAvg/ratingCount` on write.

#### Payments (Razorpay)

- **Per-prompt:** Razorpay **Orders API** → Checkout.js modal on the client → verify `razorpay_signature` (HMAC-SHA256 with key secret) server-side on the callback → mark `Purchase.status = "paid"`. Never trust client success alone.
- **Subscriptions:** Razorpay **Subscriptions API** — create two Plans (weekly, monthly) once via a setup script (`scripts/razorpay-setup.ts`), then create a Subscription per user and open Checkout in subscription mode.
- **Webhooks (`/api/webhooks/razorpay`):** verify `X-Razorpay-Signature` against `RAZORPAY_WEBHOOK_SECRET`; process `payment.captured`, `payment.failed`, `subscription.activated`, `subscription.charged`, `subscription.halted`, `subscription.cancelled`, `subscription.completed`. **Idempotent:** insert event id into `WebhookEvent` first (unique index); duplicate → 200 and skip. Webhooks are the source of truth for subscription state; the client callback is only a UX fast path.
- **Billing page (`/settings/billing`):** current plan, renewal date, cancel subscription (stays active until period end), purchase history with amounts. Refunds are manual/off-platform for now — no self-serve refund UI.
- Currency: INR only at launch (Razorpay-native; UPI, cards, netbanking come free with Checkout). International cards work if enabled on the Razorpay account — no code change.
- Note (non-legal): digital-goods GST applies in India; keep every `Purchase`/`Subscription` row export-friendly for the accountant. Confirm specifics with a tax professional.

#### Admin (minimal)

- `/admin/market` gated by `user.role === "admin"` (add `role` to User): CRUD for catalog prompts and variants, publish/unpublish, price edit. Plain forms — no CMS.

**M5 acceptance:** non-buyer can never obtain variant content via UI, API, or page source; test-mode per-prompt purchase unlocks immediately after webhook; subscription lapse revokes catalog access but purchased prompts stay; "Send to phone" QR from an unlocked prompt scans and copies correctly; duplicate webhook delivery does not double-create purchases.

---

## 6. API Surface (route handlers under `/api`)

The web UI may use server actions; these JSON endpoints exist for the **extension** (and future clients). All return `{ data } | { error: { code, message } }`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/prompts` | optional | Create. Body: `{ content, expiresIn?, oneTime?, e2e?, ciphertext? }`. Returns `{ slug, url, claimToken? }` |
| GET | `/api/prompts` | required | List own (cursor pagination, `?q=&tag=&favorite=`) |
| GET | `/api/prompts/:slug` | owner | Full record incl. plaintext (server-encrypted mode) |
| PATCH | `/api/prompts/:slug` | owner | Edit content (living QR), tags, favorite, expiry |
| DELETE | `/api/prompts/:slug` | owner | Soft delete |
| POST | `/api/claim` | required | `{ claims: [{slug, claimToken}] }` → attach to user |
| GET | `/{slug}/raw` | public | `text/plain` body (404/410 semantics as §5.2; not available for e2e) |
| GET | `/api/market` | public | Catalog list (previews only; `?category=&model=&sort=`) |
| GET | `/api/market/:slug` | public | Detail; includes variant content **only** if caller has access |
| POST | `/api/market/:slug/order` | required | Create Razorpay order for per-prompt purchase → `{ orderId, amount, keyId }` |
| POST | `/api/market/:slug/verify` | required | Verify checkout signature → activate Purchase |
| POST | `/api/market/subscribe` | required | Create Razorpay subscription (`{ plan }`) → checkout params |
| POST | `/api/market/:slug/rate` | access | `{ stars, comment? }` upsert own rating |
| POST | `/api/webhooks/razorpay` | signature | Razorpay events (idempotent, source of truth) |

Auth: session cookie **or** `Authorization: Bearer <apiToken>`. CORS: allow extension origins for `/api/*`.

---

## 7. Non-Functional Requirements

- **Security:** plaintext is never rendered as HTML — always text nodes / `textContent` (this is the XSS defense; no content sanitization needed). Strict CSP on scan pages. Server-side encryption at rest (GCM) for all non-e2e content. Slugs unguessable (nanoid 8, ~2.8×10¹² space) but treat as bearer capability — never index scan pages (`X-Robots-Tag: noindex`). Rate limits: guest create 20/day/IP, authed 200/day, scan-page 60/min/IP.
- **Performance:** scan page budget per §5.2. Create page interactive < 2 s. QR generation client-side where possible.
- **Accessibility:** WCAG AA contrast, full keyboard operability, `aria-live` on copy feedback, respects `prefers-reduced-motion`.
- **Theming:** dark mode throughout (next-themes, exists). 8 px spacing rhythm, restrained micro-animations.
- **Testing:** unit tests for encryption round-trip, mode-selection logic (`chooseQrMode(charCount)`), slug generation, variable parsing. Playwright e2e: create→scan→copy (both modes), one-time view, expiry, guest claim. Extension: manual test checklist in `extension/TESTING.md`.
- **Env:** `MONGODB_URI`, `ENCRYPTION_KEY`, `AUTH_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL`; M5 adds `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`. Fail fast at boot if missing (marketplace vars only required once M5 code paths exist).

---

## 8. Edge Cases (must handle)

- **Dark-mode scanning:** QR always renders dark modules on a light card with ≥ 4-module quiet zone, in both themes. Never invert.
- **Duplicate content:** same `contentHash` + same owner + same options within 24 h → return the existing slug instead of creating (silent dedup). Different owner/guest → new record.
- **Oversized text:** reject > `MAX_CHARS` with clear count in the error. Textarea shows live "12,431 / 50,000".
- **Tampered/unknown slug:** constant-time-ish lookup, generic gone page, 404. No enumeration hints.
- **Unicode:** emoji, CJK, RTL, zero-width chars must round-trip byte-exact (test fixtures). `charCount` counts code points.
- **Whitespace fidelity:** leading indentation and blank lines preserved exactly (critical for code/prompts).
- **Clipboard API unavailable** (old browsers/insecure context): fall back to `document.execCommand` + select-all on tap.
- **Scan spikes:** scan-count writes are fire-and-forget; page render never blocks on the write.
- **Extension on restricted pages** (chrome://, web store): context menu action falls back to opening the popup.

---

## 9. Out of Scope (do not build)

Phone OTP, generic outbound webhooks, OpenTelemetry, audit logs, PDF export, AI text cleanup, team/org accounts, bulk generation, custom slug vanity names, QR logo overlays, native mobile apps. Marketplace-specific: **creator/seller marketplace** (third-party listings, revenue share, Razorpay Route, KYC, moderation), self-serve refunds, coupons, multi-currency pricing — the schema in §4 doesn't block adding these later, but do not build them now. Revisit only after M5 ships.

---

## 10. Milestone Order & Definition of Done

**M0 hardening → M1 core loop → M2 accounts/dashboard → M3 extension → M4 differentiators → M5 marketplace.** Ship each milestone fully (including its acceptance criteria and tests) before starting the next. A milestone is done when: acceptance criteria pass, `next build` is clean, tests green, no TODOs in shipped paths, and the feature works on mobile Safari + Chrome Android (scan pages) or Chrome + Firefox (extension). M5 additionally requires end-to-end verification in Razorpay **test mode** (both payment types + at least one replayed duplicate webhook) before switching to live keys.
