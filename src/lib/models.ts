import mongoose, { Schema } from "mongoose";

const PromptSchema = new Schema(
    {
        shortSlug: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        // AES-256-GCM ciphertext (server-encrypted mode)
        encryptedContent: {
            type: String,
            required: true,
        },
        iv: {
            type: String,
            required: true,
        },
        authTag: {
            type: String,
        },
        // sha256 of plaintext — dedup per owner (SPEC §8)
        contentHash: {
            type: String,
        },
        // first 60 chars of plaintext, stored plaintext for dashboard lists
        title: {
            type: String,
            default: "",
        },
        charCount: {
            type: Number,
            default: 0,
        },
        ownerUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        isGuest: {
            type: Boolean,
            default: true,
        },
        // random token returned to guest creators; used for guest→account claim (M2)
        claimToken: {
            type: String,
            default: null,
        },
        // M4: content is client-encrypted; server never sees plaintext
        e2e: {
            type: Boolean,
            default: false,
        },
        scanCount: {
            type: Number,
            default: 0,
        },
        lastScanAt: {
            type: Date,
        },
        expiresAt: {
            type: Date,
            default: null,
        },
        isOneTimeView: {
            type: Boolean,
            default: false,
        },
        isFavorite: {
            type: Boolean,
            default: false,
        },
        tags: {
            type: [String],
            default: [],
        },
        // last 10 previous contents, for living QRs (M2)
        versions: {
            type: [
                new Schema(
                    {
                        encryptedContent: String,
                        iv: String,
                        authTag: String,
                        editedAt: Date,
                    },
                    { _id: false }
                ),
            ],
            default: [],
        },
        // soft delete; hard-delete via TTL after 30 days
        deletedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

// Dashboard queries
PromptSchema.index({ ownerUserId: 1, createdAt: -1 });
// Dedup lookup (SPEC §8)
PromptSchema.index({ contentHash: 1, ownerUserId: 1 });
// Expiry: Mongo removes the doc once expiresAt passes (null = never)
PromptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Soft-deleted rows are purged 30 days after deletion
PromptSchema.index({ deletedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const UserSchema = new Schema({
    email: { type: String, unique: true, sparse: true },
    name: String,
    image: String,
    // hashed, for extension auth fallback (M2)
    apiToken: { type: String, default: null },
    tier: { type: String, default: "free" },
    // gates /admin/market (M5)
    role: { type: String, enum: ["user", "admin"], default: "user" },
    createdAt: { type: Date, default: Date.now },
});

// Prevent overwriting models during hot reload
export const Prompt = mongoose.models.Prompt || mongoose.model("Prompt", PromptSchema);
export const User = mongoose.models.User || mongoose.model("User", UserSchema);

// Per-scan analytics event (SPEC §5 M4): daily buckets, device class,
// referrer host — no fingerprinting, and the whole row expires in 90 days.
const ScanEventSchema = new Schema({
    promptId: { type: mongoose.Schema.Types.ObjectId, ref: "Prompt", required: true },
    at: { type: Date, default: Date.now },
    deviceClass: { type: String, enum: ["mobile", "desktop"], default: "desktop" },
    referrer: { type: String, default: "" }, // host only, never the full URL
});
ScanEventSchema.index({ promptId: 1, at: -1 });
ScanEventSchema.index({ at: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const ScanEvent =
    mongoose.models.ScanEvent || mongoose.model("ScanEvent", ScanEventSchema);

// ——— Marketplace collections (SPEC §4, M5) ———

// One sellable prompt, curated in-house; paid content lives in variants,
// one per target model, encrypted at rest with the same GCM helper.
const CatalogPromptSchema = new Schema(
    {
        slug: { type: String, required: true, unique: true }, // human-readable
        title: { type: String, required: true },
        description: { type: String, default: "" },
        category: { type: String, required: true }, // writing / coding / marketing / research / …
        previewText: { type: String, default: "" }, // free teaser, ~200 chars + sample output
        variants: {
            type: [
                new Schema(
                    {
                        model: { type: String, required: true }, // "claude" | "gpt" | "gemini" | "llama" | "generic"
                        modelLabel: { type: String, required: true },
                        content: { type: String, required: true }, // GCM ciphertext
                        iv: { type: String, required: true },
                        authTag: { type: String, required: true },
                    },
                    { _id: false }
                ),
            ],
            default: [],
        },
        priceINR: { type: Number, default: null }, // paise; null → PROMPT_DEFAULT_INR
        ratingAvg: { type: Number, default: 0 },
        ratingCount: { type: Number, default: 0 },
        isPublished: { type: Boolean, default: false },
        publishedAt: { type: Date, default: null },
    },
    { timestamps: true }
);
CatalogPromptSchema.index({ isPublished: 1, category: 1 });

// Permanent per-prompt access; webhooks are the source of truth for status.
const PurchaseSchema = new Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        catalogPromptId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CatalogPrompt",
            required: true,
        },
        razorpayOrderId: { type: String, required: true, unique: true },
        razorpayPaymentId: { type: String, default: null },
        amountINR: { type: Number, required: true }, // paise, as charged
        status: {
            type: String,
            enum: ["created", "paid", "failed", "refunded"],
            default: "created",
        },
    },
    { timestamps: true }
);
// One *paid* purchase per (user, prompt); retries of failed orders are fine.
PurchaseSchema.index(
    { userId: 1, catalogPromptId: 1 },
    { unique: true, partialFilterExpression: { status: "paid" } }
);
PurchaseSchema.index({ userId: 1, status: 1 });

const SubscriptionSchema = new Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        razorpaySubscriptionId: { type: String, required: true, unique: true },
        plan: { type: String, enum: ["weekly", "monthly"], required: true },
        status: {
            type: String,
            enum: ["created", "active", "past_due", "cancelled", "expired"],
            default: "created",
        },
        currentPeriodEnd: { type: Date, default: null },
    },
    { timestamps: true }
);
SubscriptionSchema.index({ userId: 1, status: 1 });

const RatingSchema = new Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        catalogPromptId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CatalogPrompt",
            required: true,
        },
        stars: { type: Number, min: 1, max: 5, required: true },
        comment: { type: String, default: "" },
    },
    { timestamps: true }
);
RatingSchema.index({ userId: 1, catalogPromptId: 1 }, { unique: true });

// Webhook idempotency guard: insert first, duplicate id → skip (SPEC §5 M5).
const WebhookEventSchema = new Schema({
    razorpayEventId: { type: String, required: true, unique: true },
    type: { type: String, required: true },
    processedAt: { type: Date, default: Date.now },
});

export const CatalogPrompt =
    mongoose.models.CatalogPrompt || mongoose.model("CatalogPrompt", CatalogPromptSchema);
export const Purchase = mongoose.models.Purchase || mongoose.model("Purchase", PurchaseSchema);
export const Subscription =
    mongoose.models.Subscription || mongoose.model("Subscription", SubscriptionSchema);
export const Rating = mongoose.models.Rating || mongoose.model("Rating", RatingSchema);
export const WebhookEvent =
    mongoose.models.WebhookEvent || mongoose.model("WebhookEvent", WebhookEventSchema);

const RateLimitSchema = new Schema({
    ip: { type: String, required: true },
    action: { type: String, required: true },
    count: { type: Number, default: 1 },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }, // TTL index
});

// One counter doc per (key, action); the unique index makes concurrent
// upserts converge on a single doc instead of silently duplicating.
RateLimitSchema.index({ ip: 1, action: 1 }, { unique: true });

export const RateLimit = mongoose.models.RateLimit || mongoose.model("RateLimit", RateLimitSchema);
