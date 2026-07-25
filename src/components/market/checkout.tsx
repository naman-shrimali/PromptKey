"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// Razorpay Checkout.js integration (SPEC §5 M5). The modal is the UX
// fast path; server-side signature verification + webhooks decide truth.

declare global {
    interface Window {
        Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
    }
}

async function loadCheckoutJs(): Promise<void> {
    if (window.Razorpay) return;
    await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Couldn't load the payment window"));
        document.head.appendChild(script);
    });
}

const buttonCls =
    "cursor-pointer rounded-2xl bg-primary px-8 py-3 font-display text-sm font-semibold text-primary-foreground shadow-[0_6px_18px_color-mix(in_srgb,var(--primary)_35%,transparent)] transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60";
const subtleCls =
    "cursor-pointer rounded-full border-[1.5px] border-border bg-card px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:border-ring hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60";

export function BuyButton({ slug, priceLabel }: { slug: string; priceLabel: string }) {
    const [pending, setPending] = useState(false);
    const router = useRouter();

    const buy = async () => {
        setPending(true);
        try {
            const orderRes = await fetch(`/api/market/${slug}/order`, { method: "POST" });
            const orderBody = await orderRes.json();
            if (!orderRes.ok) throw new Error(orderBody.error?.message ?? "Order failed");

            await loadCheckoutJs();
            const { orderId, amount, keyId } = orderBody.data;
            new window.Razorpay!({
                key: keyId,
                order_id: orderId,
                amount,
                currency: "INR",
                name: "PromptKey",
                description: "Prompt purchase",
                handler: async (response: Record<string, string>) => {
                    const verifyRes = await fetch(`/api/market/${slug}/verify`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(response),
                    });
                    if (verifyRes.ok) {
                        toast.success("Unlocked! 🎉");
                        router.refresh();
                    } else {
                        toast.error("Payment received — unlocking may take a moment");
                        setTimeout(() => router.refresh(), 4000);
                    }
                },
                modal: { ondismiss: () => setPending(false) },
                theme: { color: "#7c5cfc" },
            }).open();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Payment failed to start");
            setPending(false);
        }
    };

    return (
        <button type="button" onClick={buy} disabled={pending} className={buttonCls}>
            {pending ? "Opening…" : `Buy for ${priceLabel} — yours forever`}
        </button>
    );
}

export function SubscribeButtons({
    weeklyLabel,
    monthlyLabel,
}: {
    weeklyLabel: string;
    monthlyLabel: string;
}) {
    const [pending, setPending] = useState<"weekly" | "monthly" | null>(null);
    const router = useRouter();

    const subscribe = async (plan: "weekly" | "monthly") => {
        setPending(plan);
        try {
            const res = await fetch("/api/market/subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plan }),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body.error?.message ?? "Subscription failed");

            await loadCheckoutJs();
            new window.Razorpay!({
                key: body.data.keyId,
                subscription_id: body.data.subscriptionId,
                name: "PromptKey",
                description: `Catalog subscription (${plan})`,
                handler: () => {
                    toast.success("Subscription started — unlocking the catalog ✨");
                    setTimeout(() => router.refresh(), 3000);
                },
                modal: { ondismiss: () => setPending(null) },
                theme: { color: "#7c5cfc" },
            }).open();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Subscription failed to start");
            setPending(null);
        }
    };

    return (
        <div className="flex flex-wrap justify-center gap-2">
            <button
                type="button"
                onClick={() => subscribe("weekly")}
                disabled={pending !== null}
                className={subtleCls}
            >
                {pending === "weekly" ? "Opening…" : `Weekly · ${weeklyLabel}`}
            </button>
            <button
                type="button"
                onClick={() => subscribe("monthly")}
                disabled={pending !== null}
                className={subtleCls}
            >
                {pending === "monthly" ? "Opening…" : `Monthly · ${monthlyLabel}`}
            </button>
        </div>
    );
}
