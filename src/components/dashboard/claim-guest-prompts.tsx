"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getClaims, clearClaims } from "@/lib/claims";

// On first signed-in visit, hand any guest-created QRs over to the
// account (SPEC §5 M2): read localStorage, POST /api/claim, clear.
export function ClaimGuestPrompts() {
    const router = useRouter();
    const ran = useRef(false);

    useEffect(() => {
        if (ran.current) return;
        ran.current = true;

        const claims = getClaims();
        if (claims.length === 0) return;

        (async () => {
            try {
                const res = await fetch("/api/claim", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        claims: claims.map(({ slug, claimToken }) => ({ slug, claimToken })),
                    }),
                });
                if (!res.ok) return; // leave tokens for a retry next visit
                const { data } = await res.json();
                clearClaims();
                if (data.claimed > 0) {
                    toast.success(
                        data.claimed === 1
                            ? "We saved 1 QR code you made earlier 💾"
                            : `We saved ${data.claimed} QR codes you made earlier 💾`
                    );
                    router.refresh();
                }
            } catch {
                // network hiccup — tokens stay in localStorage for next time
            }
        })();
    }, [router]);

    return null;
}
