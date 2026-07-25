import { defineConfig } from "wxt";

// MV3 for Chrome + Edge + Firefox from one codebase (SPEC §5 M3).
// Permissions are deliberately minimal: no <all_urls> host permission —
// the overlay is injected via the activeTab grant that a context-menu
// click, keyboard command, or action click provides.
export default defineConfig({
    manifest: {
        name: "PromptKey",
        description: "Move text between screens with a QR — select, right-click, scan.",
        permissions: ["contextMenus", "activeTab", "storage", "scripting"],
        commands: {
            "qr-selection": {
                suggested_key: { default: "Ctrl+Shift+Q", mac: "Command+Shift+Q" },
                description: "PromptKey: QR for current selection",
            },
        },
        browser_specific_settings: {
            gecko: {
                id: "extension@promptkey.app",
                strict_min_version: "115.0",
            },
        },
    },
});
