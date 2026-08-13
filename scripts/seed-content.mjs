/**
 * Seeds real content: marketplace catalog prompts + a starter personal
 * library for one user. Idempotent — upserts by slug, safe to re-run.
 *
 *   MONGODB_URI=... ENCRYPTION_KEY=... SEED_USER_EMAIL=you@example.com \
 *     node scripts/seed-content.mjs
 *
 * SEED_USER_EMAIL is optional; without it only the catalog is seeded.
 * Pass --catalog-only or --library-only to limit scope.
 *
 * All prompt text here is original, written for PromptKey. Prompts use
 * {{variable}} placeholders so the scan page's variable inputs (M4) have
 * something to work with.
 */

import crypto from "node:crypto";
import { MongoClient } from "mongodb";

const { MONGODB_URI, ENCRYPTION_KEY, SEED_USER_EMAIL } = process.env;
if (!MONGODB_URI || !ENCRYPTION_KEY) {
    console.error("Set MONGODB_URI and ENCRYPTION_KEY first.");
    process.exit(1);
}
const catalogOnly = process.argv.includes("--catalog-only");
const libraryOnly = process.argv.includes("--library-only");

// ——— crypto, matching src/lib/encryption.ts exactly ———
const KEY = Buffer.from(
    crypto.hkdfSync("sha256", ENCRYPTION_KEY, Buffer.alloc(0), "promptkey:content-encryption:v1", 32)
);
function encrypt(text) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
    const content = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]).toString("hex");
    return { content, iv: iv.toString("hex"), authTag: cipher.getAuthTag().toString("hex") };
}
const sha256 = (t) => crypto.createHash("sha256").update(t, "utf8").digest("hex");

// Matches src/lib/nanoid.ts — no ambiguous characters.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
const slugId = () =>
    Array.from({ length: 8 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join("");

const variant = (model, modelLabel, content) => ({ model, modelLabel, ...encrypt(content) });

// ———————————————————————————————————————————————————————————
// MARKETPLACE CATALOG
// ———————————————————————————————————————————————————————————

const CATALOG = [
    // ——— Free tier (priceINR: 0) — readable by anyone, signed in or not.
    // These are the funnel: genuinely useful on their own, and they show
    // what the paid ones are like.
    {
        slug: "rubber-duck-debugger",
        title: "Rubber duck that actually asks good questions",
        description:
            "Instead of answering, it interrogates your assumptions until you spot the bug yourself — the way a sharp colleague would. Free forever.",
        category: "coding",
        previewText:
            "Do not give me the answer. Ask one question at a time about what I've assumed rather than verified…",
        priceINR: 0,
        variants: [
            variant(
                "generic",
                "Any model",
                `I'm stuck on a bug. Be a rubber duck that asks good questions rather than one that answers.

Problem: {{problem}}
What I've already tried: {{tried}}

Rules:
- Ask ONE question at a time, then wait for my answer.
- Target the gap between what I've *assumed* and what I've actually *verified*. "How do you know that?" is your best tool.
- Do not propose a fix until I've either found it myself or explicitly asked you to.
- If my answer reveals I never checked something basic, say so plainly and ask about it.

Start with the single question most likely to expose a wrong assumption.`
            ),
            variant(
                "claude",
                "Claude Sonnet 4.5",
                `<problem>{{problem}}</problem>
<already_tried>{{tried}}</already_tried>

Be a rubber duck, not an oracle. Ask questions; don't answer.

Rules:
- ONE question at a time, then stop and wait.
- Aim every question at the seam between what I assumed and what I verified. "How do you know that's true?" beats "have you tried X?"
- Withhold your hypothesis until I ask for it or I've found the bug myself.
- If I've skipped an obvious check, name it directly rather than hinting.

Before asking, think about which assumption in my description is doing the most unexamined work — then ask about that one.`
            ),
        ],
    },
    {
        slug: "make-it-shorter",
        title: "Cut it in half without losing the point",
        description:
            "Ruthless editing that removes words, not meaning. Tells you exactly what it cut and why, so you can push back. Free forever.",
        category: "writing",
        previewText:
            "Cut this to half its length. Every deletion must remove words without removing information…",
        priceINR: 0,
        variants: [
            variant(
                "generic",
                "Any model",
                `Cut this text to roughly half its length:

{{text}}

Rules:
- Remove words, never information. If a cut loses a fact, an argument, or a caveat, don't make it.
- Kill throat-clearing ("it's worth noting that", "in order to", "the fact that"), redundant pairs, and sentences that only restate the previous one.
- Keep the author's voice. Shorter, not blander.
- Preserve any numbers, names, and specifics exactly.

Output the shortened version, then a one-line note of anything you cut that carried real meaning — so I can put it back if you were wrong.`
            ),
        ],
    },
    {
        slug: "second-opinion",
        title: "Argue the other side, honestly",
        description:
            "Steelmans the position you disagree with, then tells you which parts of it are actually right. The antidote to talking yourself into things. Free forever.",
        category: "research",
        previewText:
            "Argue the strongest version of the opposite position. Then tell me which of its points genuinely land…",
        priceINR: 0,
        variants: [
            variant(
                "claude",
                "Claude Sonnet 4.5",
                `<my_position>{{position}}</my_position>
<context>{{context}}</context>

I want the strongest case against what I just said.

1. **Steelman** — argue the opposing view as its smartest advocate would. If your version is easy for me to dismiss, you haven't done it. No strawmen, no "some people say."
2. **What actually lands** — of those points, which are genuinely correct? Be specific. This is the part I need most.
3. **What survives** — which parts of my original position hold up against that?
4. **The real crux** — the one question on which this whole disagreement turns.

Don't hedge into "both sides have merit." If one side is clearly stronger, say which.`
            ),
            variant(
                "generic",
                "Any model",
                `My position: {{position}}
Context: {{context}}

Give me the strongest case against it:
1. Steelman the opposing view — the version its smartest advocate would defend, not a strawman
2. Which of those points are genuinely correct (be specific — this is what I most need)
3. What parts of my position survive
4. The single question this disagreement actually turns on

Don't retreat into "both sides have merit." If one is stronger, say so.`
            ),
        ],
    },
    {
        slug: "first-principles-explainer",
        title: "What am I actually looking at?",
        description:
            "Paste anything confusing — an error, a contract clause, a config file, a diagnosis — and get a plain explanation plus the questions you should be asking. Free forever.",
        category: "productivity",
        previewText:
            "Explain what this is, what it's for, and what I should be worried about. Flag anything that needs a professional…",
        priceINR: 0,
        variants: [
            variant(
                "generic",
                "Any model",
                `Explain this to me plainly:

{{thing}}

Tell me:
1. **What it is** — in one sentence, no jargon.
2. **What it's actually doing / saying** — the substance, not a restatement.
3. **What matters here** — the parts that would change a decision.
4. **What I should ask** — the two or three questions a knowledgeable person would ask next.

Rules:
- If something is ambiguous, say it's ambiguous rather than picking an interpretation silently.
- If this needs a doctor, lawyer, accountant, or other professional, say so up front — don't substitute for one.
- Say "I don't know" where you don't. A confident wrong answer is worse than an admitted gap.`
            ),
        ],
    },
    {
        slug: "cold-email-writer",
        title: "Cold email that actually gets replies",
        description:
            "Turns a real research signal into a 90-word cold email with a single clear ask, plus a three-touch follow-up sequence that gets shorter each time. Kills the 'hope you're well' opener for good.",
        category: "marketing",
        previewText:
            "You are an experienced SDR. Using a specific, verifiable signal about the prospect, write a 90-word cold email that leads with the signal — never flattery…\n\n— sample output —\n\"Maya — your team shipped the mobile redesign three weeks ago. Most teams we work with hit support-ticket spikes right after a redesign…\"",
        priceINR: 4900,
        variants: [
            variant(
                "claude",
                "Claude Sonnet 4.5",
                `You are an experienced B2B sales development rep known for reply rates above 12%.

<product>{{product}}</product>
<prospect>{{prospect}}</prospect>
<signal>{{signal}}</signal>

Write a cold email following these rules exactly:
- Open with the signal. Never open with flattery, "hope you're well," or "I came across your profile."
- State ONE hypothesis about a problem the signal implies. Be specific enough to be wrong.
- Give one sentence of evidence you can help (a number, a comparable customer, a mechanism).
- Close with a single low-friction ask: a 12-minute call, with two concrete time options.
- Maximum 90 words. No em dashes. No adverb stacking. No "just circling back" energy.

Then write a 3-touch follow-up sequence. Each follow-up must be shorter than the last, add a NEW piece of value (not a reminder), and the final one must be a graceful break-up that leaves the door open.

Output as:
EMAIL
---
FOLLOW-UP 1 (day 3)
FOLLOW-UP 2 (day 7)
FOLLOW-UP 3 (day 14, break-up)`
            ),
            variant(
                "gpt",
                "GPT-5",
                `Act as a senior B2B sales development rep with a track record of 12%+ reply rates.

INPUTS
Product: {{product}}
Prospect: {{prospect}}
Research signal: {{signal}}

TASK
Produce a cold email and a follow-up sequence.

EMAIL CONSTRAINTS
1. First line references the research signal concretely. Banned openers: "hope you're well", "I came across", any compliment.
2. One falsifiable hypothesis about their problem.
3. One sentence of proof (metric, comparable customer, or mechanism).
4. One ask: a 12-minute call with two specific time options.
5. Hard limit 90 words. No em dashes.

FOLLOW-UPS
Three touches (day 3, 7, 14). Each shorter than the previous. Each adds new value rather than reminding. Day 14 is a break-up email.

OUTPUT FORMAT
## Email
[subject line]
[body]

## Follow-ups
**Day 3:** …
**Day 7:** …
**Day 14 (break-up):** …`
            ),
            variant(
                "generic",
                "Any model",
                `Write a cold email for {{product}} to {{prospect}}, based on this research signal: {{signal}}

Rules:
- Open with the signal, not flattery. Never write "hope you're well."
- State one specific hypothesis about their problem.
- One sentence proving you can help.
- One ask: a 12-minute call, two time options offered.
- Max 90 words.

Then add three follow-ups (day 3, 7, 14), each shorter than the last, each adding new value instead of just reminding. Make the last one a polite break-up.`
            ),
        ],
    },
    {
        slug: "code-review-copilot",
        title: "Staff-level code review copilot",
        description:
            "Reviews a diff the way a good staff engineer does: correctness bugs first, each with a concrete failing input, then genuine simplifications with line counts. Refuses to waste your time on style nits.",
        category: "coding",
        previewText:
            "Review this diff as a staff engineer. Rank findings by severity. Every correctness claim must come with a concrete input or state that triggers the failure…\n\n— sample output —\n\"CRITICAL — `parseWindow()` returns NaN when `end < start`, which silently zeroes the rate limit. Failing input: {start: 100, end: 50}…\"",
        priceINR: 9900,
        variants: [
            variant(
                "claude",
                "Claude Sonnet 4.5",
                `You are a staff engineer doing a code review. You are respected because you find real bugs and never bikeshed.

<diff>
{{diff}}
</diff>

<context>{{context}}</context>

Review rules:
1. CORRECTNESS FIRST. For every bug, give a concrete failing input or state — "this could break" without a trigger is not a finding. If you cannot construct a failure, it is not a correctness bug; move it to a lower section.
2. Then SIMPLIFICATIONS: only where the change removes real complexity. Give the approximate line delta.
3. Never comment on formatting, naming preference, or anything a linter handles.
4. If the diff is fine, say so plainly. Do not manufacture findings to seem thorough.

Think through the control flow and edge cases before writing your findings — especially empty inputs, concurrency, and error paths.

Output:
## Blocking
- **[file:line]** what breaks · failing input · why
## Worth fixing
## Nice to have
## Verdict
SHIP or BLOCK, one sentence why.`
            ),
            variant(
                "gpt",
                "GPT-5",
                `You are a staff engineer reviewing a pull request. Reputation: finds real bugs, never bikesheds.

DIFF:
{{diff}}

CONTEXT: {{context}}

Think step by step through the control flow, edge cases (empty input, concurrency, error paths), then report.

RULES
- Every correctness finding needs a concrete failing input or state. No speculative "this might break."
- Simplifications must include an approximate line delta.
- Zero style/formatting/naming comments — a linter covers those.
- An honest "this looks correct" is a valid review.

OUTPUT
### Blocking
[file:line] — what breaks | failing input | why it matters
### Worth fixing
### Nice to have
### Verdict
SHIP or BLOCK + one-sentence rationale.`
            ),
        ],
    },
    {
        slug: "research-brief-builder",
        title: "Decision-ready research brief",
        description:
            "Compresses a messy topic into a one-page brief you can actually decide from: claims tagged by confidence, the strongest counter-argument steelmanned, and an explicit statement of what evidence would flip the conclusion.",
        category: "research",
        previewText:
            "Build a decision brief on the topic below. Five key claims, each tagged high/medium/low confidence. Steelman the strongest opposing view…\n\n— sample output —\n\"CLAIM (high confidence): Migration cost is dominated by data backfill, not application rewrite…\"",
        priceINR: null,
        variants: [
            variant(
                "gemini",
                "Gemini 2.5 Pro",
                `Produce a one-page decision brief on: {{topic}}

Decision being made: {{decision}}

Structure:
1. BOTTOM LINE — one sentence a busy person could act on.
2. KEY CLAIMS — exactly 5. Tag each [HIGH] / [MEDIUM] / [LOW] confidence. A claim with no supporting evidence gets [LOW] and says so.
3. STRONGEST COUNTER-ARGUMENT — steelman it. Write the version its smartest advocate would recognize, not a strawman you can knock down.
4. WHAT WOULD CHANGE MY MIND — the specific evidence or event that would flip the bottom line.
5. SOURCES — ranked by reliability, noting any that are vendor-published or otherwise motivated.

Rules: distinguish what is established from what is contested. Where experts genuinely disagree, say so rather than averaging them into false consensus. Flag your own uncertainty explicitly.`
            ),
            variant(
                "claude",
                "Claude Sonnet 4.5",
                `<topic>{{topic}}</topic>
<decision>{{decision}}</decision>

Write a one-page decision brief.

Think first about what is actually established versus contested, and where the evidence is thin — then write.

Format:
**Bottom line:** one actionable sentence.

**Key claims** (exactly 5, each tagged [HIGH]/[MEDIUM]/[LOW] confidence)

**Steelman of the opposing view:** the version its smartest advocate would endorse. If you find yourself writing something easy to dismiss, you have not steelmanned it.

**What would change my mind:** specific, observable evidence.

**Sources:** ranked, with vendor-published or otherwise motivated sources marked.

Do not average genuine expert disagreement into false consensus. Say "this is contested" when it is.`
            ),
            variant(
                "generic",
                "Any model",
                `Write a one-page decision brief on {{topic}} for this decision: {{decision}}

Include:
- Bottom line (one actionable sentence)
- 5 key claims, each labelled high/medium/low confidence
- The strongest opposing argument, stated fairly rather than as a strawman
- What specific evidence would change the conclusion
- Sources ranked by reliability, flagging any with a vendor interest

Where experts genuinely disagree, say so instead of splitting the difference.`
            ),
        ],
    },
    {
        slug: "meeting-notes-to-decisions",
        title: "Meeting transcript → decisions and owners",
        description:
            "Turns a rambling transcript into the only three things that matter afterwards: what was decided, who owns what by when, and which questions are still open. Separates decisions from discussion.",
        category: "productivity",
        previewText:
            "Extract decisions, owned action items, and open questions from this transcript. Never invent an owner — if nobody accepted a task, mark it UNOWNED…\n\n— sample output —\n\"DECIDED: Ship behind a flag to 5% on Thursday (Priya, in-meeting agreement)…\"",
        priceINR: 4900,
        variants: [
            variant(
                "claude",
                "Claude Sonnet 4.5",
                `<transcript>
{{transcript}}
</transcript>

Extract only what a person who missed this meeting needs.

**Decisions** — things actually settled. Include who decided. If a decision was implied but never confirmed out loud, list it under Open questions instead, not here.

**Action items** — format: owner · task · due date. Rules:
- Never invent an owner. If nobody explicitly accepted it, write "UNOWNED" — that is a useful signal, not a failure.
- Never invent a deadline. Write "no date set" if none was agreed.

**Open questions** — anything raised and left unresolved, plus anything that sounded decided but was never confirmed.

**Ignore entirely:** small talk, tangents that went nowhere, and repeated restatements of the same point.

If the transcript contains no real decisions, say so directly rather than padding the list.`
            ),
            variant(
                "gpt",
                "GPT-5",
                `Transcript:
{{transcript}}

Produce a summary for someone who missed the meeting.

## Decisions
Only things actually settled, with who decided. Implied-but-unconfirmed decisions belong in Open Questions, not here.

## Action items
| Owner | Task | Due |
Rules: never invent an owner (use UNOWNED), never invent a due date (use "no date set").

## Open questions
Unresolved items + anything that sounded decided but was never confirmed aloud.

Omit small talk, dead-end tangents, and repetition. If nothing was decided, say exactly that.`
            ),
            variant(
                "generic",
                "Any model",
                `From this meeting transcript, extract three things:

{{transcript}}

1. DECISIONS — what was actually settled, and by whom
2. ACTION ITEMS — owner, task, due date. Write UNOWNED if nobody accepted it, and "no date set" if no deadline was agreed. Never guess either.
3. OPEN QUESTIONS — what was left unresolved

Skip small talk and tangents. If nothing was really decided, say so.`
            ),
        ],
    },
    {
        slug: "pr-description-writer",
        title: "Pull request description from a diff",
        description:
            "Writes the PR description reviewers actually want: what changed and why, the risky part called out honestly, and how to verify it. Trained to admit uncertainty instead of overselling.",
        category: "coding",
        previewText:
            "Write a PR description from this diff. Lead with why, not what. Name the riskiest part of the change explicitly…\n\n— sample output —\n\"**Why:** rate limiter allowed bursts past the cap under concurrency. **Riskiest part:** the atomic upsert changes write behaviour on every create path…\"",
        priceINR: 4900,
        variants: [
            variant(
                "claude",
                "Claude Sonnet 4.5",
                `<diff>
{{diff}}
</diff>
<ticket>{{ticket}}</ticket>

Write a pull request description.

**Why** — the problem this solves, in two sentences a reviewer who lacks context can follow. Lead with why, never with a file list.

**What changed** — grouped by intent, not by file. Three to six bullets.

**Riskiest part** — name it honestly. Every non-trivial change has one. "Low risk" is only acceptable if you explain why the blast radius is genuinely contained.

**How to verify** — concrete steps or commands a reviewer can run, plus what they should see.

**Not included** — anything deliberately left out of scope, so nobody reviews it as missing.

Do not oversell. If part of the change is a workaround rather than a fix, label it as one.`
            ),
            variant(
                "gpt",
                "GPT-5",
                `Diff:
{{diff}}

Ticket: {{ticket}}

Write a PR description with these exact sections:

**Why** — the problem, in 2 sentences, for a reviewer without context. Lead with why, not a file list.
**What changed** — 3-6 bullets grouped by intent, not by file.
**Riskiest part** — name it honestly. "Low risk" requires justification of why the blast radius is contained.
**How to verify** — commands/steps plus expected result.
**Not included** — deliberate scope exclusions.

Label workarounds as workarounds. Do not oversell the change.`
            ),
        ],
    },
    {
        slug: "user-interview-synthesizer",
        title: "User interview → product signal",
        description:
            "Separates what users literally said from what they actually did, and flags the difference. Built to resist the classic trap of treating polite enthusiasm as demand.",
        category: "research",
        previewText:
            "Analyse these interview notes. Separate reported behaviour from observed behaviour and flag every place a user expressed enthusiasm without a matching action…\n\n— sample output —\n\"STATED: 'I'd definitely pay for that.' OBSERVED: has not used the free workaround in 3 months. → discount heavily.\"",
        priceINR: 9900,
        variants: [
            variant(
                "claude",
                "Claude Sonnet 4.5",
                `<interviews>
{{notes}}
</interviews>

<question>{{question}}</question>

Synthesize these interviews. Your job is to protect the team from believing things that are not true.

**Observed behaviour** — what users actually do today, including the workarounds they have already built. Weight this heavily.

**Stated preferences** — what they said they want. Weight this lightly.

**Contradictions** — every place stated enthusiasm is not backed by an action. Format: STATED "…" vs OBSERVED … → interpretation. This section is the most valuable output; do not skip it when it is uncomfortable.

**Pain ranked by evidence strength** — a pain someone built a spreadsheet to work around outranks a pain three people said was annoying.

**What we still do not know** — the questions these interviews did not answer.

Rules: never treat politeness as demand. Do not smooth contradictory accounts into a tidy narrative. If the sample is too small to conclude anything, say that plainly.`
            ),
            variant(
                "gpt",
                "GPT-5",
                `Interview notes:
{{notes}}

Research question: {{question}}

Synthesize. Priority: prevent the team from believing false things.

### Observed behaviour
What users actually do, including existing workarounds. Weight heavily.

### Stated preferences
What they said they want. Weight lightly.

### Contradictions
Every gap between stated enthusiasm and actual action.
Format: STATED "..." | OBSERVED ... | Interpretation
Do not skip uncomfortable ones.

### Pain ranked by evidence strength
A built workaround > a complaint.

### Still unknown
Questions these interviews did not answer.

Never treat politeness as demand. Do not smooth contradictions into a clean story. Flag insufficient sample size directly.`
            ),
            variant(
                "generic",
                "Any model",
                `Analyse these user interview notes for the question "{{question}}":

{{notes}}

Separate:
1. What users actually DO today (including workarounds they built) — weight this heavily
2. What users SAID they want — weight this lightly
3. CONTRADICTIONS between the two — this is the most important section
4. Pains ranked by strength of evidence (a built workaround beats a complaint)
5. What these interviews did not answer

Never treat politeness or enthusiasm as proof of demand.`
            ),
        ],
    },
    {
        slug: "incident-postmortem",
        title: "Blameless incident postmortem",
        description:
            "Produces a postmortem that finds systemic causes instead of a person to blame, with a timeline, contributing factors, and action items that would actually have prevented it.",
        category: "coding",
        previewText:
            "Write a blameless postmortem. Every 'human error' must be traced to the system that permitted it…\n\n— sample output —\n\"Contributing factor: deploy tooling allowed a config push to prod without a diff preview. The engineer's mistake was the expected outcome of that design.\"",
        priceINR: 9900,
        variants: [
            variant(
                "claude",
                "Claude Sonnet 4.5",
                `<incident>{{incident}}</incident>
<timeline>{{timeline}}</timeline>

Write a blameless postmortem.

**Impact** — who was affected, how badly, for how long. Numbers where you have them, "unknown" where you do not.

**Timeline** — detection, diagnosis, mitigation, resolution. Note the gaps: time-to-detect and time-to-mitigate are usually where the real lesson is.

**Contributing factors** — plural, always. Single-cause incidents are almost always incomplete analysis. For each factor, ask why the system permitted it.

**The blameless rule (strict):** every instance of "someone made a mistake" must be rewritten as "the system allowed this mistake to reach production." If you name a person, you have failed. Name the missing guardrail instead.

**Action items** — each must pass this test: would this specific change have prevented THIS incident, or meaningfully reduced its impact? Cut anything that fails. Mark each as prevention / detection / mitigation.

**What went well** — including luck. If you got lucky, say so, because luck is not a control.`
            ),
            variant(
                "gpt",
                "GPT-5",
                `Incident: {{incident}}
Timeline: {{timeline}}

Write a blameless postmortem.

**Impact:** who, how bad, how long. Use "unknown" rather than guessing.
**Timeline:** detection → diagnosis → mitigation → resolution. Call out time-to-detect and time-to-mitigate gaps.
**Contributing factors:** always plural. For each, explain why the system permitted it.
**Blameless rule:** rewrite every "human error" as "the system allowed this to reach production." Naming a person = failed analysis. Name the missing guardrail.
**Action items:** each must pass "would this have prevented THIS incident?" Delete the rest. Tag as prevention/detection/mitigation.
**What went well:** include luck, and label it as luck.`
            ),
        ],
    },
    {
        slug: "explain-like-an-engineer",
        title: "Explain any system without dumbing it down",
        description:
            "Explains a complex system at exactly the depth you ask for, building from what you already know instead of from a generic analogy. Includes the part most explanations skip: why the obvious simpler design does not work.",
        category: "writing",
        previewText:
            "Explain the topic to someone who already understands the listed concepts. Do not restate what they know. Include why the obvious simpler approach fails…\n\n— sample output —\n\"You already understand hash maps, so: a consistent hash ring is the same lookup, but the failure mode you care about is rebalancing…\"",
        priceINR: null,
        variants: [
            variant(
                "claude",
                "Claude Sonnet 4.5",
                `<topic>{{topic}}</topic>
<audience_already_knows>{{background}}</audience_already_knows>

Explain the topic to someone with exactly that background.

Rules:
1. Build from what they already know. Do not re-explain the listed concepts, and do not reach for a generic analogy (no post offices, no restaurants) when a precise technical comparison to their existing knowledge will do.
2. Include the part most explanations skip: **why the obvious simpler design does not work.** This is usually where real understanding lives.
3. Name the tradeoff being made. Every non-trivial system chose something and gave up something.
4. Where your explanation is a simplification, say so and note what you left out.
5. Stop when the concept is clear. Do not pad with a summary of what you just said.

Length: whatever the idea actually requires. A precise paragraph beats a vague page.`
            ),
            variant(
                "generic",
                "Any model",
                `Explain {{topic}} to someone who already knows: {{background}}

Rules:
- Build on what they know; don't re-explain it, and skip generic analogies if a precise technical comparison works
- Include why the obvious simpler approach fails — this is the part most explanations skip
- Name the tradeoff the design makes
- Flag where you're simplifying and what you left out
- Stop when it's clear; no padding summary`
            ),
        ],
    },
];

// ———————————————————————————————————————————————————————————
// PERSONAL LIBRARY (regular Prompt records, owned by SEED_USER_EMAIL)
// ———————————————————————————————————————————————————————————

const LIBRARY = [
    {
        tags: ["writing", "email"],
        isFavorite: true,
        content: `Rewrite this message so it stays direct but lands better:

{{message}}

Keep: the actual ask, any deadline, the facts.
Remove: hedging ("just", "sorry to bother", "I was wondering if maybe"), fake enthusiasm, and apologies for existing.
Do not make it longer. Directness is not rudeness — the goal is clear and warm, not soft.`,
    },
    {
        tags: ["coding", "git"],
        isFavorite: true,
        content: `Write a conventional commit message for this diff:

{{diff}}

Format: type(scope): subject — imperative mood, under 72 characters, no trailing period.
Body only if the "why" is not obvious from the subject. Explain why, not what; the diff already shows what.
Add "BREAKING CHANGE:" footer if the public interface changed.`,
    },
    {
        tags: ["debugging", "coding"],
        content: `I'm debugging this and I'm stuck.

Symptom: {{symptom}}
What I've already tried: {{tried}}
Relevant code/logs: {{context}}

Do not suggest what I've already tried. Instead:
1. List what the symptom PROVES is true, and what it only suggests
2. Name the assumption I'm most likely making that's wrong
3. Give me the single cheapest experiment that would distinguish between the top two hypotheses

Ask me for missing information rather than guessing at it.`,
    },
    {
        tags: ["learning"],
        content: `I want to learn {{skill}}. I currently know {{current_level}} and I have {{time_available}} per week.

Build me a roadmap that:
- Starts with the thing that unlocks the most other things, not the thing that's easiest
- Names one concrete project per stage — something with a definition of done, not "practice X"
- Tells me explicitly what to SKIP for now and why (this matters more than what to include)
- Flags where I'll likely plateau and what gets me past it

Be honest about the timeline. If this realistically takes a year, say a year.`,
    },
    {
        tags: ["writing", "review"],
        content: `Edit this for clarity without flattening my voice:

{{text}}

Do:
- Cut sentences that carry no new information
- Replace abstract nouns with concrete ones
- Fix genuine ambiguity

Don't:
- Homogenise the rhythm — varied sentence length is a feature
- Replace specific words with safer generic ones
- Add transition phrases ("furthermore", "in conclusion") that add length but no meaning

Show the edited version, then list the three biggest changes and why.`,
    },
    {
        tags: ["product", "planning"],
        content: `Pressure-test this plan before I commit to it:

{{plan}}

1. What has to be true for this to work? List the assumptions, riskiest first.
2. Which assumption is cheapest to test THIS WEEK?
3. What's the failure mode nobody on the team will want to raise?
4. If this fails in three months, what will the retro most likely say?

Be blunt. I'm asking because I want the problems now, not later.`,
    },
];

// ———————————————————————————————————————————————————————————

const client = new MongoClient(MONGODB_URI);
await client.connect();
const db = client.db();

if (!libraryOnly) {
    let created = 0;
    let updated = 0;
    for (const doc of CATALOG) {
        const existing = await db.collection("catalogprompts").findOne({ slug: doc.slug });
        await db.collection("catalogprompts").updateOne(
            { slug: doc.slug },
            {
                $set: {
                    ...doc,
                    isPublished: true,
                    publishedAt: existing?.publishedAt ?? new Date(),
                    updatedAt: new Date(),
                },
                $setOnInsert: { createdAt: new Date(), ratingAvg: 0, ratingCount: 0 },
            },
            { upsert: true }
        );
        if (existing) updated++;
        else created++;
    }
    console.log(`Catalog: ${created} created, ${updated} updated (${CATALOG.length} total).`);
}

if (!catalogOnly) {
    if (!SEED_USER_EMAIL) {
        console.log("Library: skipped (set SEED_USER_EMAIL to seed a personal library).");
    } else {
        const user = await db.collection("users").findOne({ email: SEED_USER_EMAIL });
        if (!user) {
            console.log(`Library: skipped — no user with email ${SEED_USER_EMAIL}.`);
        } else {
            let added = 0;
            for (const item of LIBRARY) {
                const contentHash = sha256(item.content);
                // Idempotent: same content + same owner is never duplicated.
                const dupe = await db
                    .collection("prompts")
                    .findOne({ contentHash, ownerUserId: user._id, deletedAt: null });
                if (dupe) continue;

                const enc = encrypt(item.content);
                await db.collection("prompts").insertOne({
                    shortSlug: slugId(),
                    encryptedContent: enc.content,
                    iv: enc.iv,
                    authTag: enc.authTag,
                    contentHash,
                    title: item.content.slice(0, 60),
                    charCount: [...item.content].length,
                    ownerUserId: user._id,
                    isGuest: false,
                    claimToken: null,
                    e2e: false,
                    scanCount: 0,
                    isOneTimeView: false,
                    isFavorite: !!item.isFavorite,
                    tags: item.tags,
                    versions: [],
                    expiresAt: null,
                    deletedAt: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
                added++;
            }
            console.log(
                `Library: ${added} added for ${SEED_USER_EMAIL} (${LIBRARY.length - added} already present).`
            );
        }
    }
}

await client.close();
