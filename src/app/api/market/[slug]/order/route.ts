import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { resolveApiUserId } from "@/lib/api-auth";
import { Purchase } from "@/lib/models";
import { findPublishedCatalogPrompt, hasPurchased, isFreePrompt, priceOf } from "@/lib/market-access";
import { createOrder, razorpayKeyId } from "@/lib/razorpay";

export const dynamic = "force-dynamic";

// POST /api/market/:slug/order — create a Razorpay order for a
// per-prompt purchase (SPEC §6) → { orderId, amount, keyId }.
export async function POST(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;
    await dbConnect();

    const userId = await resolveApiUserId(request);
    if (!userId) {
        return NextResponse.json(
            { error: { code: "unauthorized", message: "Sign in to buy prompts" } },
            { status: 401 }
        );
    }

    const prompt = await findPublishedCatalogPrompt(slug);
    if (!prompt) {
        return NextResponse.json(
            { error: { code: "not_found", message: "No such catalog prompt" } },
            { status: 404 }
        );
    }

    // Razorpay rejects zero-amount orders, and charging for free content
    // would be wrong anyway — fail loudly rather than at the gateway.
    if (isFreePrompt(prompt)) {
        return NextResponse.json(
            { error: { code: "free_prompt", message: "This prompt is free — no purchase needed" } },
            { status: 400 }
        );
    }

    if (await hasPurchased(userId, String(prompt._id))) {
        return NextResponse.json(
            { error: { code: "already_owned", message: "You already own this prompt" } },
            { status: 409 }
        );
    }

    try {
        const amount = priceOf(prompt);
        const order = await createOrder({
            amountPaise: amount,
            receipt: `${userId}:${prompt._id}`.slice(0, 40),
            notes: { catalogPromptId: String(prompt._id), userId },
        });

        await Purchase.create({
            userId,
            catalogPromptId: prompt._id,
            razorpayOrderId: order.id,
            amountINR: amount,
            status: "created",
        });

        return NextResponse.json({
            data: { orderId: order.id, amount, keyId: razorpayKeyId() },
        });
    } catch (error) {
        console.error("Order creation failed:", error);
        return NextResponse.json(
            { error: { code: "payment_unavailable", message: "Payments aren't available right now" } },
            { status: 502 }
        );
    }
}
