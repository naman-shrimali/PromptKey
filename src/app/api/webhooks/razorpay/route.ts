import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { processWebhookEvent } from "@/lib/webhook-handlers";

export const dynamic = "force-dynamic";

// POST /api/webhooks/razorpay (SPEC §5 M5): verify X-Razorpay-Signature
// against the raw body, then process idempotently. Always 200 for
// well-signed events (including duplicates) so Razorpay stops retrying.
export async function POST(request: Request) {
    const rawBody = await request.text();

    if (!verifyWebhookSignature(rawBody, request.headers.get("x-razorpay-signature"))) {
        return NextResponse.json(
            { error: { code: "bad_signature", message: "Signature verification failed" } },
            { status: 400 }
        );
    }

    let event;
    try {
        event = JSON.parse(rawBody);
    } catch {
        return NextResponse.json(
            { error: { code: "invalid", message: "Body is not JSON" } },
            { status: 400 }
        );
    }

    // Razorpay sends the event id in a header; keep it with the payload.
    event.id = request.headers.get("x-razorpay-event-id") ?? event.id;

    await dbConnect();
    const outcome = await processWebhookEvent(event);

    return NextResponse.json({ data: outcome });
}
