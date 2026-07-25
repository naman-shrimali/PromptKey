"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import dbConnect from "@/lib/db";
import { Subscription } from "@/lib/models";
import { cancelSubscription } from "@/lib/razorpay";

/**
 * Cancel at cycle end (SPEC §5 M5): access continues until
 * currentPeriodEnd; the subscription.cancelled webhook flips the status
 * when Razorpay actually ends it.
 */
export async function cancelOwnSubscription() {
    const session = await auth();
    if (!session?.user?.id) return { error: "Not signed in" };

    await dbConnect();
    const sub = await Subscription.findOne({
        userId: session.user.id,
        status: { $in: ["active", "past_due"] },
    }).sort({ currentPeriodEnd: -1 });
    if (!sub) return { error: "No active subscription" };

    try {
        await cancelSubscription(sub.razorpaySubscriptionId);
    } catch (error) {
        console.error("Subscription cancel failed:", error);
        return { error: "Couldn't reach the payment provider — try again" };
    }

    revalidatePath("/settings/billing");
    return { success: true };
}
