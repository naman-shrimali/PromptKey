/**
 * Dev seed for the marketplace: three published catalog prompts with
 * GCM-encrypted variants, plus admin role for a chosen user.
 *
 *   MONGODB_URI=... ENCRYPTION_KEY=... [ADMIN_EMAIL=you@example.com] \
 *     node scripts/seed-market.mjs
 */

import crypto from "node:crypto";
import { MongoClient } from "mongodb";

const { MONGODB_URI, ENCRYPTION_KEY, ADMIN_EMAIL } = process.env;
if (!MONGODB_URI || !ENCRYPTION_KEY) {
    console.error("Set MONGODB_URI and ENCRYPTION_KEY first.");
    process.exit(1);
}

// Must match src/lib/encryption.ts
const KEY = Buffer.from(
    crypto.hkdfSync("sha256", ENCRYPTION_KEY, Buffer.alloc(0), "promptkey:content-encryption:v1", 32)
);
function enc(text) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
    const content = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]).toString("hex");
    return { content, iv: iv.toString("hex"), authTag: cipher.getAuthTag().toString("hex") };
}

const variant = (model, modelLabel, content) => ({ model, modelLabel, ...enc(content) });

const CATALOG = [
    {
        slug: "cold-email-writer",
        title: "Cold email that actually gets replies",
        description:
            "A researched, personalized cold-email generator with objection handling and a follow-up sequence. Tuned separately per model family.",
        category: "marketing",
        previewText:
            'You are an expert SDR. Given a prospect\'s LinkedIn summary and my product one-liner, write a 90-word cold email that…\n\n— sample output —\n"Hi Maya — saw your team just shipped the mobile redesign…"',
        priceINR: 4900,
        ratingAvg: 0,
        ratingCount: 0,
        isPublished: true,
        publishedAt: new Date(),
        variants: [
            variant("claude", "Claude Sonnet 4.5", "You are an expert SDR writing for {{product}}. Research signals: {{signals}}.\n\nWrite a 90-word cold email:\n1. Open with the researched signal, not flattery.\n2. One concrete pain hypothesis.\n3. Single CTA: a 12-minute call.\nThen write a 3-touch follow-up sequence, each shorter than the last."),
            variant("gpt", "GPT-5", "Act as a senior SDR for {{product}}. Using {{signals}}, produce: (a) 90-word cold email leading with the signal, (b) pain hypothesis in one line, (c) 12-minute-call CTA, (d) three follow-ups with decreasing length. No em dashes, no 'hope you're well'."),
            variant("generic", "Any model", "Write a 90-word cold email for {{product}} using research signals {{signals}}. Lead with the signal, one pain hypothesis, one CTA (12-minute call). Add 3 follow-ups, each shorter."),
        ],
    },
    {
        slug: "code-review-copilot",
        title: "Staff-level code review copilot",
        description:
            "Turns any diff into a prioritized review: correctness first, then simplification, with concrete failure scenarios for every finding.",
        category: "coding",
        previewText:
            "Review the following diff as a staff engineer. Rank findings by severity; every correctness claim needs a concrete failing input…",
        priceINR: 9900,
        ratingAvg: 0,
        ratingCount: 0,
        isPublished: true,
        publishedAt: new Date(),
        variants: [
            variant("claude", "Claude Sonnet 4.5", "Review this diff as a staff engineer:\n\n{{diff}}\n\nRules: correctness findings first, each with a concrete failing input/state; then simplifications with LOC deltas; never style nits. End with a one-paragraph risk verdict."),
            variant("gpt", "GPT-5", "You are a staff engineer reviewing:\n\n{{diff}}\n\nOutput sections: CRITICAL (bug + failing input), SIMPLIFY (with line counts), SHIP/BLOCK verdict. Skip style commentary entirely."),
        ],
    },
    {
        slug: "research-brief-builder",
        title: "Deep research brief builder",
        description:
            "Compresses any topic into a decision-ready brief: claims with confidence levels, disagreements surfaced, sources ranked.",
        category: "research",
        previewText:
            "Build a decision brief on {{topic}}: 5 key claims with confidence (high/med/low), the strongest counter-argument, and what would change the conclusion…",
        priceINR: null, // uses PROMPT_DEFAULT_INR
        ratingAvg: 0,
        ratingCount: 0,
        isPublished: true,
        publishedAt: new Date(),
        variants: [
            variant("gemini", "Gemini 2.5 Pro", "Research {{topic}} and produce a one-page decision brief: 5 claims each tagged high/med/low confidence, the strongest counter-argument stated steelman-style, 3 ranked sources, and 'what evidence would flip this conclusion'."),
            variant("generic", "Any model", "Produce a decision brief on {{topic}}: 5 confidence-tagged claims, one steelmanned counter-argument, ranked sources, and the evidence that would change the answer."),
        ],
    },
];

const client = new MongoClient(MONGODB_URI);
await client.connect();
const db = client.db();

for (const doc of CATALOG) {
    await db.collection("catalogprompts").updateOne(
        { slug: doc.slug },
        { $set: { ...doc, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
        { upsert: true }
    );
}
console.log(`Seeded ${CATALOG.length} catalog prompts.`);

if (ADMIN_EMAIL) {
    const res = await db
        .collection("users")
        .updateOne({ email: ADMIN_EMAIL }, { $set: { role: "admin" } });
    console.log(
        res.matchedCount ? `${ADMIN_EMAIL} is now an admin.` : `No user with email ${ADMIN_EMAIL}.`
    );
}

await client.close();
