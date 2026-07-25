import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import dbConnect from "@/lib/db";
import { CatalogPrompt, Purchase, Subscription } from "@/lib/models";
import { hasActiveSubscription } from "@/lib/market-access";
import { CancelSubscriptionButton } from "@/components/market/cancel-subscription";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;
const fmtDate = (d: Date) =>
    new Date(d).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });

export default async function BillingPage() {
    const session = await auth();
    if (!session?.user) redirect("/login");
    const userId = session.user.id as string;

    await dbConnect();
    const sub = await Subscription.findOne({
        userId,
        status: { $in: ["active", "past_due", "created"] },
    })
        .sort({ currentPeriodEnd: -1 })
        .lean<any>();
    const active = await hasActiveSubscription(userId);

    // Export-friendly purchase rows (SPEC §5 M5 GST note): amount,
    // status, ids, timestamps all visible.
    const purchases = await Purchase.find({ userId }).sort({ createdAt: -1 }).limit(50).lean();
    const titles = new Map(
        (
            await CatalogPrompt.find({
                _id: { $in: purchases.map((p: any) => p.catalogPromptId) },
            }).select("title")
        ).map((c: any) => [String(c._id), c.title as string])
    );

    return (
        <div className="mx-auto w-full max-w-xl px-5 pb-20 pt-4">
            <Link href="/settings" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
                ← Settings
            </Link>
            <h1 className="mt-2 font-display text-2xl font-bold">Billing</h1>

            {/* Subscription */}
            <section className="mt-5 rounded-3xl border-[1.5px] border-border bg-card p-5">
                <h2 className="font-display text-sm font-bold">Catalog subscription</h2>
                {sub && active ? (
                    <>
                        <p className="mt-2 text-sm">
                            <span className="rounded-full border-[1.5px] border-ring bg-accent px-2.5 py-0.5 text-xs font-bold">
                                {sub.status === "past_due" ? "⚠️ payment due" : "✓ active"}
                            </span>{" "}
                            <span className="font-semibold capitalize">{sub.plan}</span> plan
                            {sub.currentPeriodEnd && (
                                <span className="text-muted-foreground">
                                    {" "}
                                    · renews {fmtDate(sub.currentPeriodEnd)}
                                </span>
                            )}
                        </p>
                        <div className="mt-3">
                            <CancelSubscriptionButton />
                        </div>
                    </>
                ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                        No active subscription.{" "}
                        <Link href="/market" className="font-semibold text-primary hover:underline">
                            Browse the market →
                        </Link>
                    </p>
                )}
            </section>

            {/* Purchases */}
            <section className="mt-4 rounded-3xl border-[1.5px] border-border bg-card p-5">
                <h2 className="font-display text-sm font-bold">Purchases</h2>
                {purchases.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                        No purchases yet. Bought prompts stay yours forever — even if a
                        subscription lapses.
                    </p>
                ) : (
                    <ul className="mt-2 flex flex-col gap-1.5">
                        {purchases.map((p: any) => (
                            <li
                                key={String(p._id)}
                                className="flex items-center justify-between gap-3 rounded-xl border-[1.5px] border-border px-4 py-2.5 text-sm"
                            >
                                <span className="min-w-0 truncate">
                                    {titles.get(String(p.catalogPromptId)) ?? "(removed prompt)"}
                                    <span className="ml-2 text-xs text-muted-foreground">
                                        {fmtDate(p.createdAt)}
                                    </span>
                                </span>
                                <span className="shrink-0 text-xs">
                                    <b>{inr(p.amountINR)}</b>{" "}
                                    <span
                                        className={
                                            p.status === "paid"
                                                ? "text-foreground"
                                                : "text-muted-foreground"
                                        }
                                    >
                                        · {p.status}
                                    </span>
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                    Need a refund? Email us — refunds are handled manually for now.
                </p>
            </section>
        </div>
    );
}
