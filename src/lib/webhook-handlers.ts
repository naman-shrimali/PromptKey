import { Purchase, Subscription, WebhookEvent } from "./models";

// Webhook processing (SPEC §5 M5). Idempotent by construction: the
// event id is inserted into WebhookEvent (unique index) BEFORE any
// side effect — a duplicate delivery short-circuits to a 200.
// Webhooks are the source of truth for payment/subscription state.

/* eslint-disable @typescript-eslint/no-explicit-any */

export type WebhookOutcome = {
    duplicate: boolean;
    handled: boolean;
};

export async function processWebhookEvent(event: {
    id?: string;
    event: string;
    payload?: any;
}): Promise<WebhookOutcome> {
    // Razorpay's x-razorpay-event-id header maps to event.id in tests;
    // fall back to a payload-derived id so replays stay deduplicated.
    const eventId =
        event.id ??
        `${event.event}:${
            event.payload?.payment?.entity?.id ??
            event.payload?.subscription?.entity?.id ??
            "unknown"
        }`;

    try {
        await WebhookEvent.create({ razorpayEventId: eventId, type: event.event });
    } catch (error: unknown) {
        if ((error as { code?: number })?.code === 11000) {
            return { duplicate: true, handled: false };
        }
        throw error;
    }

    switch (event.event) {
        case "payment.captured": {
            const payment = event.payload?.payment?.entity;
            if (payment?.order_id) {
                await Purchase.updateOne(
                    { razorpayOrderId: payment.order_id },
                    { $set: { status: "paid", razorpayPaymentId: payment.id ?? null } }
                );
            }
            return { duplicate: false, handled: true };
        }
        case "payment.failed": {
            const payment = event.payload?.payment?.entity;
            if (payment?.order_id) {
                // never downgrade a purchase the captured event already paid
                await Purchase.updateOne(
                    { razorpayOrderId: payment.order_id, status: "created" },
                    { $set: { status: "failed" } }
                );
            }
            return { duplicate: false, handled: true };
        }
        case "subscription.activated":
        case "subscription.charged": {
            const sub = event.payload?.subscription?.entity;
            if (sub?.id) {
                await Subscription.updateOne(
                    { razorpaySubscriptionId: sub.id },
                    {
                        $set: {
                            status: "active",
                            currentPeriodEnd: sub.current_end
                                ? new Date(sub.current_end * 1000)
                                : null,
                        },
                    }
                );
            }
            return { duplicate: false, handled: true };
        }
        case "subscription.halted": {
            const sub = event.payload?.subscription?.entity;
            if (sub?.id) {
                await Subscription.updateOne(
                    { razorpaySubscriptionId: sub.id },
                    { $set: { status: "past_due" } }
                );
            }
            return { duplicate: false, handled: true };
        }
        case "subscription.cancelled": {
            const sub = event.payload?.subscription?.entity;
            if (sub?.id) {
                await Subscription.updateOne(
                    { razorpaySubscriptionId: sub.id },
                    { $set: { status: "cancelled" } }
                );
            }
            return { duplicate: false, handled: true };
        }
        case "subscription.completed": {
            const sub = event.payload?.subscription?.entity;
            if (sub?.id) {
                await Subscription.updateOne(
                    { razorpaySubscriptionId: sub.id },
                    { $set: { status: "expired" } }
                );
            }
            return { duplicate: false, handled: true };
        }
        default:
            // Unknown events are acknowledged (and recorded) but not acted on.
            return { duplicate: false, handled: false };
    }
}
