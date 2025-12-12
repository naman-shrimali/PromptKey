const mongoose = require('mongoose');
const { Schema } = mongoose;

const PromptSchema = new Schema({
    shortSlug: { type: String, required: true, unique: true, index: true },
    encryptedContent: { type: String, required: true },
    iv: { type: String, required: true },
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    isGuest: { type: Boolean, default: true },
    scanCount: { type: Number, default: 0 },
    lastScanAt: { type: Date },
    options: {
        expiresAt: Date,
        isOneTimeView: { type: Boolean, default: false }
    }
}, { timestamps: true });

const Prompt = mongoose.models.Prompt || mongoose.model("Prompt", PromptSchema);

async function checkSlug() {
    try {
        await mongoose.connect('mongodb://localhost:27017/promptkey');
        console.log("Connected to DB");

        const slug = '6eOaRgbWbo';
        const prompt = await Prompt.findOne({ shortSlug: slug });

        if (prompt) {
            console.log("Found prompt:", JSON.stringify(prompt, null, 2));
        } else {
            console.log("Prompt not found for slug:", slug);
            // List all prompts to see what's there
            const allPrompts = await Prompt.find({}, 'shortSlug');
            console.log("All slugs:", allPrompts.map(p => p.shortSlug));
        }
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await mongoose.disconnect();
    }
}

checkSlug();
