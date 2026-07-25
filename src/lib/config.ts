// SPEC.md-driven product constants (§5 M0). Single source of truth —
// import from here instead of hardcoding limits.

export const MAX_CHARS = 50_000; // absolute input limit
export const QR_DIRECT_MAX = 1_000; // offline mode available at or below this
export const QR_DIRECT_DEFAULT = 500; // offline mode is the default at or below this
export const GUEST_DAILY_LIMIT = 20; // creations per IP per day
export const AUTHED_DAILY_LIMIT = 200; // creations per user per day (§7)
export const GUEST_MAX_TTL_DAYS = 30;
export const SLUG_LENGTH = 8;

// Marketplace (M5) — amounts in paise; the UI renders INR (SPEC §5 M5).
// CatalogPrompt.priceINR can override the per-prompt default.
export const SUB_WEEKLY_INR = 9_900; // ₹99 / week
export const SUB_MONTHLY_INR = 29_900; // ₹299 / month
export const PROMPT_DEFAULT_INR = 4_900; // ₹49 per prompt
export const PAST_DUE_GRACE_DAYS = 3;
