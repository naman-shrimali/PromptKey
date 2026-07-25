"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// 1–5 stars + optional short comment; one rating per user, editable
// (SPEC §5 M5). The server re-checks access on every write.
export function RatingWidget({
    slug,
    initialStars,
    initialComment,
}: {
    slug: string;
    initialStars: number;
    initialComment: string;
}) {
    const [stars, setStars] = useState(initialStars);
    const [comment, setComment] = useState(initialComment);
    const [pending, startTransition] = useTransition();
    const router = useRouter();

    const submit = () => {
        if (stars < 1) {
            toast.error("Pick a star rating first");
            return;
        }
        startTransition(async () => {
            const res = await fetch(`/api/market/${slug}/rate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ stars, comment: comment.trim() || undefined }),
            });
            if (res.ok) {
                toast.success(initialStars ? "Rating updated" : "Thanks for rating ⭐");
                router.refresh();
            } else {
                const body = await res.json().catch(() => null);
                toast.error(body?.error?.message ?? "Rating failed");
            }
        });
    };

    return (
        <div className="rounded-2xl border-[1.5px] border-border bg-card p-4">
            <div className="flex items-center gap-1" role="radiogroup" aria-label="Your rating">
                {[1, 2, 3, 4, 5].map((n) => (
                    <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={stars === n}
                        aria-label={`${n} star${n === 1 ? "" : "s"}`}
                        onClick={() => setStars(n)}
                        className={`cursor-pointer text-xl transition-transform hover:scale-110 ${
                            n <= stars ? "text-amber-500" : "text-muted-foreground opacity-40"
                        }`}
                    >
                        ★
                    </button>
                ))}
                <span className="ml-2 text-xs text-muted-foreground">
                    {initialStars ? "Update your rating" : "Rate this prompt"}
                </span>
            </div>
            <div className="mt-3 flex gap-2">
                <input
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    maxLength={500}
                    placeholder="Optional short comment…"
                    className="h-10 min-w-0 flex-1 rounded-xl border-[1.5px] border-border bg-card px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
                />
                <button
                    type="button"
                    onClick={submit}
                    disabled={pending}
                    className="cursor-pointer rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                >
                    {pending ? "…" : "Save"}
                </button>
            </div>
        </div>
    );
}
