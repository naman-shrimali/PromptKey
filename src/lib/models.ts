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
    createdAt: { type: Date, default: Date.now },
});

// Prevent overwriting models during hot reload
export const Prompt = mongoose.models.Prompt || mongoose.model("Prompt", PromptSchema);
export const User = mongoose.models.User || mongoose.model("User", UserSchema);

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
