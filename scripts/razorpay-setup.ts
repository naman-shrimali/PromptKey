/**
 * One-off Razorpay setup (SPEC §5 M5): creates the weekly and monthly
 * subscription Plans. Run once per Razorpay account (test mode first!):
 *
 *   RAZORPAY_KEY_ID=rzp_test_… RAZORPAY_KEY_SECRET=… \
 *     npx tsx scripts/razorpay-setup.ts
 *
 * Put the printed plan ids into the environment as
 * RAZORPAY_PLAN_WEEKLY_ID and RAZORPAY_PLAN_MONTHLY_ID.
 */

const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;
if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    console.error("Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET first.");
    process.exit(1);
}

// Keep in sync with src/lib/config.ts
const SUB_WEEKLY_INR = 9_900;
const SUB_MONTHLY_INR = 29_900;

const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");

async function createPlan(period: "weekly" | "monthly", amountPaise: number) {
    const res = await fetch("https://api.razorpay.com/v1/plans", {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            period,
            interval: 1,
            item: {
                name: `PromptKey catalog — ${period}`,
                amount: amountPaise,
                currency: "INR",
                description: "Unlimited access to the PromptKey prompt catalog",
            },
        }),
    });
    const body = await res.json();
    if (!res.ok) {
        throw new Error(body?.error?.description ?? `Plan creation failed (${res.status})`);
    }
    return body.id as string;
}

const weekly = await createPlan("weekly", SUB_WEEKLY_INR);
const monthly = await createPlan("monthly", SUB_MONTHLY_INR);

console.log("Add these to your environment:");
console.log(`RAZORPAY_PLAN_WEEKLY_ID=${weekly}`);
console.log(`RAZORPAY_PLAN_MONTHLY_ID=${monthly}`);

export {};
