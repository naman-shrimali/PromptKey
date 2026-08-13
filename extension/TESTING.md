# PromptKey Extension — Manual Test Checklist

Per SPEC §7, the extension is verified manually before each release.

## Setup

```bash
cd extension
npm install
npm run build            # Chrome/Edge → .output/chrome-mv3
npm run build:firefox    # Firefox (MV3) → .output/firefox-mv3
```

- **Chrome/Edge:** `chrome://extensions` → enable Developer mode → *Load unpacked* → pick `.output/chrome-mv3`.
- **Firefox:** `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on…* → pick any file in `.output/firefox-mv3`.
- Point the extension at your server: extension **Options** → set server URL
  (default `http://localhost:3000`) → *Test connection*.

## 1. Context menu (offline mode)

- [ ] Select a short sentence on any https page → right-click → **PromptKey: QR for selection**.
- [ ] Overlay card appears top-right in < 1 s with a QR and the "Offline QR" badge.
- [ ] **With DevTools → Network open: no request is made.** (Acceptance: works with network disabled.)
- [ ] Scan the QR with a phone camera — the exact selected text appears, including line breaks.
- [ ] Select text containing emoji / non-Latin script — scan decodes it byte-exact.
- [ ] `Esc` and the ✕ button both dismiss the overlay; page styling is unaffected (shadow DOM).

## 2. Keyboard shortcut

- [ ] Select text → `Ctrl+Shift+Q` (`Cmd+Shift+Q` on macOS) → same overlay, < 1 s.
- [ ] With nothing selected → overlay shows the "select some text first" message.
- [ ] If the shortcut is taken by another extension, remap at `chrome://extensions/shortcuts`.

## 3. Long selection (link mode)

- [ ] Select > 1,000 characters → overlay shows a QR with the "Link QR" badge and short URL + Copy.
- [ ] The URL opens the scan page with the full text.
- [ ] While signed out: creation still works (guest, rate-limited), link expires in 7 days.

## 3b. Insert directly into Claude / ChatGPT / Gemini

- [ ] Open `claude.ai`, `chatgpt.com`, and `gemini.google.com` in turn. On each, click the
      PromptKey toolbar icon — the popup's primary button should read **"⚡ Insert into
      {site}"**, and "Make my QR" should drop to a secondary style.
- [ ] Paste a multi-line prompt into the popup, click Insert → a confirmation modal appears
      **in the page** showing a preview and char count. Nothing has been inserted yet.
- [ ] Click **Cancel** (and separately, press `Esc`, and click the backdrop) → modal closes,
      the composer is untouched.
- [ ] Click **Insert into {site}** → the text lands in the site's message box at the cursor.
      **Nothing is auto-sent** — you still press enter yourself.
- [ ] Insert while the composer already has text → the prompt is inserted at the cursor
      rather than wiping what's there.
- [ ] Verify multi-line prompts keep their line breaks. Note: a literal tab character may be
      normalized to a space in contenteditable composers (Claude/ChatGPT/Gemini) — this is
      browser behavior for rich-text editors. Spaces, blank lines, emoji, and RTL survive intact.
- [ ] Open a non-AI site (e.g. `github.com`) → the Insert button is **hidden** and the popup
      behaves exactly as before.

**If insertion breaks after a site redesign:** the selector chains live in
`extension/utils/ai-sites.ts` and are the only thing that should need updating. The modal
reports a clear error ("Couldn't find the … message box") rather than failing silently.

## 3c. Insert from your saved library

- [ ] Signed out (and no API token set) → the popup's **Library** section shows a hint to
      sign in. No error, no empty crash.
- [ ] With a token set in Options → Library lists your saved prompts with char counts.
- [ ] Type in the **Filter** box → the list narrows by title.
- [ ] Click a library row → its full text loads into the popup editor, ready to tweak.
- [ ] On an AI site, click the **⚡** on a row → confirmation modal → text goes straight into
      the composer, without first loading it into the editor.
- [ ] **A one-time-view prompt stays unconsumed** after loading it from the library. Verify:
      load it, then open its public `/{slug}` link — it should still render (and only then be
      consumed). Library reads use the owner endpoint precisely so this holds.
- [ ] **Scan counts don't move** when reading from the library. Check a prompt's scan count on
      the dashboard before and after loading it in the popup.
- [ ] An **end-to-end encrypted** prompt appears greyed with a `🔒 e2e` tag and a disabled ⚡;
      hovering explains only the original link's key can open it.

## 4. Popup

- [ ] Click the toolbar icon with text selected → textarea is pre-filled with the selection.
- [ ] Live char counter; Offline/Link mode pills switch automatically at 500/1,000 bytes; the
      disabled Offline pill shows "too long for offline QR".
- [ ] Link mode shows expiry presets (1h/24h/7d/30d) and the one-time toggle.
- [ ] *Make my QR* renders the QR; PNG download and Copy image work; Copy URL copies the link.
- [ ] **Recent** shows the last 5 items; after signing in (or saving an API token), link items
      come from the server library.

## 5. Auth (API token)

- [ ] Website → Settings → API token → Generate; paste into extension Options → *Test connection*
      says "Connected".
- [ ] Create a link QR from the popup → it appears in the website dashboard (acceptance).
- [ ] Revoke the token on the website → *Test connection* now reports not signed in;
      popup creations fall back to guest links.

## 6. Restricted pages (SPEC §8)

- [ ] On `chrome://extensions` (or the Chrome Web Store), the context menu is unavailable, and
      `Ctrl+Shift+Q` opens the popup window fallback instead of failing silently.

## 7. Cross-browser

- [ ] Repeat sections 1, 2, and 4 on Firefox and Edge.
