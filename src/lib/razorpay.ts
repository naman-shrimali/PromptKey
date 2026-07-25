import crypto from "crypto";

// Thin Razorpay REST client (SPEC §5 M5). Plain fetch + basic auth —
// no SDK dependency. Keys are validated lazily so the rest of the app
// runs without marketplace env vars until these code paths are used.

const API_BASE = "https://api.razorpay.com/v1";

export function razorpayKeyId(): string {
    const id = process.env.RAZORPAY_KEY_ID;
    if (!id) throw new Error("RAZORPAY_KEY_ID is not set");
    return id;
}

function keySecret(): string {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) throw new Error("RAZORPAY_KEY_SECRET is not set");
    return secret;
}

function webhookSecret(): string {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) throw new Error("RAZORPAY_WEBHOOK_SECRET is not set");
    return secret;
}

async function rzpFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const auth = Buffer.from(`${razorpayKeyId()}:${keySecret()}`).toString("base64");
    const res = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
            ...(init.headers as Record<string, string>),
        },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
        const message =
            (body as { error?: { description?: string } })?.error?.description ??
            `Razorpay error (${res.status})`;
        throw new Error(message);
    }
    return body as T;
}

export type RazorpayOrder = { id: string; amount: number; currency: string };

export function createOrder(opts: {
    amountPaise: number;
    receipt: string;
    notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
    return rzpFetch<RazorpayOrder>("/orders", {
        method: "POST",
        body: JSON.stringify({
            amount: opts.amountPaise,
            currency: "INR",
            receipt: opts.receipt,
            notes: opts.notes ?? {},
        }),
    });
}

export type RazorpaySubscription = { id: string; status: string };

export function createSubscription(opts: {
    planId: string;
    totalCount: number;
    notes?: Record<string, string>;
}): Promise<RazorpaySubscription> {
    return rzpFetch<RazorpaySubscription>("/subscriptions", {
        method: "POST",
        body: JSON.stringify({
            plan_id: opts.planId,
            total_count: opts.totalCount,
            customer_notify: 1,
            notes: opts.notes ?? {},
        }),
    });
}

export function cancelSubscription(subscriptionId: string): Promise<RazorpaySubscription> {
    // Stays active until the period end (SPEC §5 M5 billing page).
    return rzpFetch<RazorpaySubscription>(`/subscriptions/${subscriptionId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ cancel_at_cycle_end: 1 }),
    });
}

function timingSafeHexEqual(a: string, b: string): boolean {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/**
 * Checkout callback verification (SPEC §5 M5): HMAC-SHA256 of
 * "order_id|payment_id" with the key secret. Never trust client success
 * alone — but this is only the UX fast path; webhooks stay the truth.
 */
export function verifyCheckoutSignature(opts: {
    orderId: string;
    paymentId: string;
    signature: string;
}): boolean {
    const expected = crypto
        .createHmac("sha256", keySecret())
        .update(`${opts.orderId}|${opts.paymentId}`)
        .digest("hex");
    return timingSafeHexEqual(expected, opts.signature);
}

/** X-Razorpay-Signature = HMAC-SHA256 of the raw body with the webhook secret. */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
    if (!signature) return false;
    const expected = crypto
        .createHmac("sha256", webhookSecret())
        .update(rawBody)
        .digest("hex");
    return timingSafeHexEqual(expected, signature);
}
