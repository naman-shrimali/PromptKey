import { NextResponse } from "next/server";
import { z } from "zod";
import dbConnect from "@/lib/db";
import { resolveApiUserId } from "@/lib/api-auth";
import { Subscription } from "@/lib/models";
import { hasActiveSubscription } from "@/lib/market-access";
import { createSubscription, razorpayKeyId } from "@/lib/razorpay";

export const dynamic = "force-dynamic";

const PLAN_ENV: Record<string, string | undefined> = {
    weekly: process.env.RAZORPAY_PLAN_WEEKLY_ID,
    monthly: process.env.RAZORPAY_PLAN_MONTHLY_ID,
};

// POST /api/market/subscribe { plan } → checkout params (SPEC §6).
export async function POST(request: Request) {
    await dbConnect();

    const userId = await resolveApiUserId(request);
    if (!userId) {
        return NextResponse.json(
            { error: { code: "unauthorized", message: "Sign in to subscribe" } },
            { status: 401 }
        );
    }

    const parsed = z
        .object({ plan: z.enum(["weekly", "monthly"]) })
        .safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json(
            { error: { code: "invalid", message: "Body must be { plan: 'weekly' | 'monthly' }" } },
            { status: 400 }
        );
    }

    if (await hasActiveSubscription(userId)) {
        return NextResponse.json(
            { error: { code: "already_subscribed", message: "You already have an active subscription" } },
            { status: 409 }
        );
    }

    const planId = PLAN_ENV[parsed.data.plan];
    if (!planId) {
        return NextResponse.json(
            { error: { code: "payment_unavailable", message: "Subscription plans aren't configured" } },
            { status: 502 }
        );
    }

    try {
        const subscription = await createSubscription({
            planId,
            // weekly ≈ 1 year of cycles, monthly ≈ 3 years — renewable later
            totalCount: parsed.data.plan === "weekly" ? 52 : 36,
            notes: { userId },
        });

        await Subscription.create({
            userId,
            razorpaySubscriptionId: subscription.id,
            plan: parsed.data.plan,
            status: "created",
        });

        return NextResponse.json({
            data: { subscriptionId: subscription.id, keyId: razorpayKeyId() },
        });
    } catch (error) {
        console.error("Subscription creation failed:", error);
        return NextResponse.json(
            { error: { code: "payment_unavailable", message: "Payments aren't available right now" } },
            { status: 502 }
        );
    }
}
