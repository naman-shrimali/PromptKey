import mongoose, { Schema } from "mongoose";

const PromptSchema = new Schema({
    shortSlug: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    // We store encrypted content, not raw text
    encryptedContent: {
        type: String,
        required: true
    },
    // Initialization Vector for encryption (crucial for uniqueness)
    iv: {
        type: String,
        required: true
    },
    ownerUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    isGuest: {
        type: Boolean,
        default: true
    },
    scanCount: {
        type: Number,
        default: 0
    },
    lastScanAt: {
        type: Date
    },
    options: {
        expiresAt: Date, // For guest TTL
        isOneTimeView: { type: Boolean, default: false }
    }
}, { timestamps: true });

// Compound index for dashboard queries
PromptSchema.index({ ownerUserId: 1, createdAt: -1 });

const UserSchema = new Schema({
    email: { type: String, unique: true, sparse: true },
    name: String,
    image: String,
    createdAt: { type: Date, default: Date.now },
});

// Prevent overwriting models during hot reload
export const Prompt = mongoose.models.Prompt || mongoose.model("Prompt", PromptSchema);
export const User = mongoose.models.User || mongoose.model("User", UserSchema);

const RateLimitSchema = new Schema({
    ip: { type: String, required: true, index: true },
    action: { type: String, required: true }, // e.g., "generate"
    count: { type: Number, default: 1 },
    expiresAt: { type: Date, required: true, index: { expires: 0 } } // TTL index
});

export const RateLimit = mongoose.models.RateLimit || mongoose.model("RateLimit", RateLimitSchema);
