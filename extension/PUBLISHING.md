# Publishing the PromptKey extension

Everything needed to go from "loads locally via Developer Mode" to "listed on
the Chrome Web Store, Firefox Add-ons, and Edge Add-ons." Researched against
each store's current (2026) policies — sources at the bottom of each section.

## Where things stand today

- Manifest V3, builds clean for Chrome/Edge (`.output/chrome-mv3`) and
  Firefox MV3 (`.output/firefox-mv3`).
- Permissions are minimal: `contextMenus`, `activeTab`, `storage`,
  `scripting` — no `<all_urls>`, no host permissions.
- `DEFAULT_API_BASE` points at `https://promptqr-nu.vercel.app`.
- Distributable zips already built: `npm run zip` (Chrome) and
  `npm run zip:firefox` (Firefox, also produces a `-sources.zip`).

## Blocking gaps — fix these before submitting anywhere

These aren't optional for any of the three stores. Nothing else in this doc
matters until they're done.

### 1. Icons (currently none)

`wxt.config.ts` has no `icons` field and there's no `public/` directory in
`extension/` — the manifest ships with **zero icons**. Every store requires
at least one. Add these files (any design tool, or ask me to generate simple
placeholders from the 🔑 mark and swap them later):

```
extension/public/icon/16.png
extension/public/icon/32.png
extension/public/icon/48.png
extension/public/icon/128.png   ← required, this is the Chrome Web Store listing icon
```

WXT auto-detects `public/icon/<size>.png` and wires them into the manifest —
no `wxt.config.ts` change needed once the files exist. Rebuild after adding
them and confirm `manifest.json` has an `"icons"` key.

### 2. Privacy policy (required — you store user data)

The extension's `storage` permission holds the API token and server URL
(`extension/utils/settings.ts`), and the popup/overlay send prompt text to
your API. Chrome Web Store's Developer Program Policy requires a privacy
policy whenever a permission grants access to user data — `storage` counts.
Firefox and Edge ask the same at submission time.

You need one page, hosted somewhere stable (a static page in the web app is
ideal — e.g. `promptqr-nu.vercel.app/privacy` — a Google Doc or GitHub Pages
page also works). At minimum, disclose:

- What's collected: the text a user selects/pastes (sent to your API to
  create a QR/link), and the API token + server URL saved in
  `chrome.storage.local`.
- Why: to create QR codes and links, and to authenticate the user against
  their PromptKey account.
- Where it goes: your PromptKey server only (name the domain). Never sold,
  never shared with third parties.
- Retention/deletion: link to the account-deletion flow already in
  `/settings` on the web app.

Once written, the URL goes into each store's listing form (Chrome: Privacy
tab in the dashboard; Firefox: Technical Details field; Edge: the new
dedicated Privacy page in the submission flow).

### 3. Screenshots + promo images

Capture these from the popup and the in-page overlay (light + dark, a couple
of real-looking QR results):

| Store | Required | Optional |
|---|---|---|
| Chrome Web Store | 128×128 icon, ≥1 screenshot (1280×800 or 640×400) | 440×280 small tile, 1400×560 marquee |
| Firefox Add-ons | none strictly required, but listings without screenshots convert poorly | up to 10 images |
| Edge Add-ons | logo + small promo tile | additional screenshots |

---

## Chrome Web Store

**Cost:** one-time $5 registration fee, covers up to 20 extensions forever.
**Review time:** typically a few hours to 3 days (90% within 3 days per
Google's own numbers); simple `activeTab`-only extensions have been reported
clearing review in minutes. Submission volume has been running high in 2026,
so budget a few days to be safe.

1. Register at the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) with a Google account, pay the $5 fee.
2. Build the package: `npm run zip` → `extension/.output/promptkey-extension-0.1.0-chrome.zip`.
3. New item → upload the zip.
4. Fill in the **Store listing**: name, one-line summary (≤132 chars), full
   description, category (Productivity fits), the icon + screenshots from
   the gaps section above.
5. Fill in **Privacy practices**: paste the privacy policy URL, and justify
   each permission in plain language. Ready-to-paste justifications for this
   extension:
   - `contextMenus` — adds the "QR for selection" right-click menu item.
   - `activeTab` — reads the current tab's text selection only when the
     user explicitly invokes the extension (menu click or shortcut); never
     runs in the background.
   - `storage` — saves the user's PromptKey server URL and API token
     locally so they don't have to re-enter them.
   - `scripting` — injects the QR overlay into the page the user is looking
     at, only on that explicit invocation.
6. Declare "single purpose": *"Turn selected text into a scannable QR code
   or shareable link."* Google's 2026 policy update (enforced from Aug 1,
   2026) is stricter about scope-creep between purpose and permissions —
   this extension's actual permission set already matches that purpose
   narrowly, which helps.
7. Submit for review. Respond fast to any reviewer questions — slow replies
   are the most common cause of long review cycles.

Sources: [Register your developer account](https://developer.chrome.com/docs/webstore/register), [Chrome Web Store Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies), [CWS policy updates 2026](https://developer.chrome.com/blog/cws-policy-updates-2026), [Fill out the privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy), [Review process](https://developer.chrome.com/docs/webstore/review-process)

---

## Firefox Add-ons (AMO)

**Cost:** free.
**Review:** all Firefox extensions are signed by Mozilla before they can run
in release Firefox — even self-distributed ones. Submitting to AMO both
lists and signs it in one step.

1. Create a free account at [addons.mozilla.org/developers](https://addons.mozilla.org/developers/).
2. Build both packages: `npm run zip:firefox` → produces
   `promptkey-extension-0.1.0-firefox.zip` **and**
   `promptkey-extension-0.1.0-sources.zip`.
3. Submit → upload the firefox zip.
4. **Upload the sources zip too.** AMO requires readable source for any
   extension whose shipped code is built/minified/transpiled — which WXT's
   Vite bundling always produces. Reviewers must be able to rebuild your
   extension from that source and get the same output; obfuscated code is
   grounds for rejection. Since `package.json` already has a `build` script,
   AMO's newer automated-build-diff check can often verify this without a
   human, which speeds up review.
5. Fill in the listing (name, summary, description, screenshots, category,
   support email/URL, privacy policy URL if you disclose it separately from
   the store's Technical Details field).
6. Choose distribution: **"On this site"** lists it publicly on AMO (what
   you want for a real launch); "On your own" self-signs it for you to host
   the file yourself — still requires the same review, just skips the
   public listing.
7. Submit. Firefox review is generally faster than Chrome's for
   well-behaved extensions with narrow permissions, but budget similar
   turnaround.

Sources: [Submitting an add-on](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/), [Source code submission](https://extensionworkshop.com/documentation/publish/source-code-submission/), [Updated Add-on policies (2025)](https://blog.mozilla.org/addons/2025/06/23/updated-add-on-policies-simplified-clarified/)

---

## Microsoft Edge Add-ons

**Cost:** free. **Review:** generally fast; Edge largely mirrors Chrome's MV3
package, so if Chrome accepted it, Edge rarely finds new issues.

1. Register at [Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/) — needs a Microsoft account (`@outlook.com`/`@live.com`/`@hotmail.com`, or a work/school MSA) as the Primary Owner. No fee.
2. You can reuse the **same Chrome zip** (`npm run zip`) — Edge is Chromium-based and accepts MV3 packages as-is.
3. New extension → upload the zip.
4. Fill in the logo, small promotional tile, and the (as of 2026) dedicated
   **Privacy** page in the submission flow — same policy content as Chrome's.
5. Submit. No listing fee, and Edge's review generally clears in a similar
   or shorter window than Chrome's.

Sources: [Publish a Microsoft Edge extension](https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/publish/publish-extension), [Register as a developer](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account), [Developer policies](https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies)

---

## Ongoing release workflow (after the first approval)

1. Bump `"version"` in `extension/package.json` (all three stores require a
   strictly increasing version number per update).
2. `npm run build && npm run build:firefox` to sanity-check both targets.
3. `npm run zip && npm run zip:firefox`.
4. Upload the new zip in each dashboard as a new version of the existing
   listing (not a new listing). Chrome/Edge updates typically re-review
   faster than first submissions; Firefox re-signs on every version.
5. If `DEFAULT_API_BASE` or the CORS-eligible origins ever change (e.g. a
   custom domain replaces `promptqr-nu.vercel.app`), update
   `extension/utils/settings.ts` before rebuilding — published users won't
   get the new default until they update.

## Common rejection reasons to avoid

- **Permission not justified by a visible feature.** Every permission in
  the manifest must map to something a reviewer can see in the UI. This
  extension is already narrow (4 permissions, no host permissions), so this
  is unlikely to bite — keep it that way if you add features later.
- **Missing or vague privacy policy.** Reviewers reject listings whose
  policy doesn't specifically name what's collected and why.
- **Remote code.** MV3 forbids fetching and `eval`-ing remote JS at
  runtime. This extension doesn't do that — the popup/overlay/background
  are fully bundled. Keep it that way; don't add a CDN script tag to the
  extension pages (that's fine on the *web app*, not inside the extension).
- **Firefox: unbuildable source zip.** Make sure `npm install && npm run
  build` from a clean clone of the sources zip actually reproduces the
  submitted package — that's exactly what AMO's automated check does.
