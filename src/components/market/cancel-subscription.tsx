"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { cancelOwnSubscription } from "@/app/actions/billing";

export function CancelSubscriptionButton() {
    const [pending, startTransition] = useTransition();

    const cancel = () => {
        if (!window.confirm("Cancel your subscription? It stays active until the period ends."))
            return;
        startTransition(async () => {
            const res = await cancelOwnSubscription();
            if (res.error) toast.error(res.error);
            else toast.success("Cancelled — access continues until the period ends");
        });
    };

    return (
        <button
            type="button"
            onClick={cancel}
            disabled={pending}
            className="cursor-pointer rounded-full border-[1.5px] border-border bg-card px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:border-destructive hover:text-destructive disabled:opacity-50"
        >
            {pending ? "Cancelling…" : "Cancel subscription"}
        </button>
    );
}
