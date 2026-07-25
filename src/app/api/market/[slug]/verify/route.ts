import { NextResponse } from "next/server";
import { z } from "zod";
import dbConnect from "@/lib/db";
import { resolveApiUserId } from "@/lib/api-auth";
import { Purchase } from "@/lib/models";
import { verifyCheckoutSignature } from "@/lib/razorpay";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
    razorpay_order_id: z.string().min(1),
    razorpay_payment_id: z.string().min(1),
    razorpay_signature: z.string().min(1),
});

// POST /api/market/:slug/verify — checkout callback fast path (SPEC §5
// M5): verify the HMAC signature server-side, then mark the purchase
// paid. The webhook remains the source of truth and is idempotent with
// this write.
export async function POST(request: Request) {
    await dbConnect();

    const userId = await resolveApiUserId(request);
    if (!userId) {
        return NextResponse.json(
            { error: { code: "unauthorized", message: "Sign in first" } },
            { status: 401 }
        );
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json(
            { error: { code: "invalid", message: "Missing Razorpay callback fields" } },
            { status: 400 }
        );
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;

    if (
        !verifyCheckoutSignature({
            orderId: razorpay_order_id,
            paymentId: razorpay_payment_id,
            signature: razorpay_signature,
        })
    ) {
        return NextResponse.json(
            { error: { code: "bad_signature", message: "Signature verification failed" } },
            { status: 400 }
        );
    }

    const result = await Purchase.updateOne(
        { razorpayOrderId: razorpay_order_id, userId },
        { $set: { status: "paid", razorpayPaymentId: razorpay_payment_id } }
    );
    if (result.matchedCount === 0) {
        return NextResponse.json(
            { error: { code: "not_found", message: "No matching order" } },
            { status: 404 }
        );
    }

    return NextResponse.json({ data: { status: "paid" } });
}
