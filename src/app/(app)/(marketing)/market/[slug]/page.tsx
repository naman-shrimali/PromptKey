import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import dbConnect from "@/lib/db";
import { Rating } from "@/lib/models";
import {
    findPublishedCatalogPrompt,
    hasAccess,
    hasActiveSubscription,
    serializeCatalogPrompt,
} from "@/lib/market-access";
import { SUB_MONTHLY_INR, SUB_WEEKLY_INR } from "@/lib/config";
import { BuyButton, SubscribeButtons } from "@/components/market/checkout";
import { VariantPanel } from "@/components/market/variant-panel";
import { RatingWidget } from "@/components/market/rating-widget";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;

export default async function MarketDetailPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    await dbConnect();

    const prompt = await findPublishedCatalogPrompt(slug);
    if (!prompt) notFound();

    const session = await auth();
    const userId = session?.user?.id ?? null;
    const access = await hasAccess(userId, String(prompt._id));
    const subscribed = userId ? await hasActiveSubscription(userId) : false;

    // The serializer is the paywall: without access, variant content
    // never reaches this page's HTML (SPEC §5 M5).
    const data: any = serializeCatalogPrompt(prompt, access);

    const myRating = userId
        ? await Rating.findOne({ userId, catalogPromptId: prompt._id }).lean<{
              stars: number;
              comment?: string;
          }>()
        : null;
    const recentRatings = await Rating.find({
        catalogPromptId: prompt._id,
        comment: { $ne: "" },
    })
        .sort({ updatedAt: -1 })
        .limit(5)
        .lean();

    return (
        <div className="mx-auto w-full max-w-[880px] px-5 pb-20 pt-6">
            <Link href="/market" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
                ← Back to market
            </Link>

            <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        {data.category}
                    </span>
                    <h1 className="mt-2 font-display text-3xl font-bold">{data.title}</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {data.ratingCount > 0 ? (
                            <>
                                <span aria-hidden="true" className="text-amber-500">
                                    {"★".repeat(Math.round(data.ratingAvg))}
                                </span>{" "}
                                {data.ratingAvg.toFixed(1)} · {data.ratingCount} rating
                                {data.ratingCount === 1 ? "" : "s"}
                            </>
                        ) : (
                            "No ratings yet"
                        )}
                    </p>
                </div>
                <span className="font-display text-2xl font-bold text-primary">
                    {inr(data.priceINR)}
                </span>
            </div>

            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed">{data.description}</p>

            {/* Free teaser */}
            {data.previewText && (
                <div className="mt-5 rounded-3xl border-[1.5px] border-border bg-card p-5">
                    <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        Preview
                    </h2>
                    <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-muted-foreground">
                        {data.previewText}
                    </pre>
                </div>
            )}

            {data.locked ? (
                <div className="mt-5 rounded-3xl border-[1.5px] border-ring bg-accent p-6 text-center">
                    <p aria-hidden="true" className="text-3xl">
                        🔐
                    </p>
                    <h2 className="mt-2 font-display text-lg font-bold">
                        {data.models.length} model-tuned variant{data.models.length === 1 ? "" : "s"} inside
                    </h2>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                        {data.models.map((m: any) => m.modelLabel).join(" · ")}
                    </p>
                    {userId ? (
                        <div className="mt-5 flex flex-col items-center gap-3">
                            <BuyButton slug={data.slug} priceLabel={inr(data.priceINR)} />
                            {!subscribed && (
                                <>
                                    <span className="text-xs font-semibold text-muted-foreground">
                                        or unlock the whole catalog
                                    </span>
                                    <SubscribeButtons
                                        weeklyLabel={`${inr(SUB_WEEKLY_INR)}/week`}
                                        monthlyLabel={`${inr(SUB_MONTHLY_INR)}/month`}
                                    />
                                </>
                            )}
                        </div>
                    ) : (
                        <Link
                            href="/login"
                            className="mt-5 inline-block rounded-2xl bg-primary px-8 py-3 font-display text-sm font-semibold text-primary-foreground"
                        >
                            Sign in to buy →
                        </Link>
                    )}
                </div>
            ) : (
                <VariantPanel slug={data.slug} variants={data.variants} />
            )}

            {/* Ratings */}
            <section className="mt-8">
                <h2 className="font-display text-sm font-bold">Ratings</h2>
                {access && userId && (
                    <div className="mt-2">
                        <RatingWidget
                            slug={data.slug}
                            initialStars={myRating?.stars ?? 0}
                            initialComment={myRating?.comment ?? ""}
                        />
                    </div>
                )}
                {!access && (
                    <p className="mt-2 text-xs text-muted-foreground">
                        Only buyers and subscribers can rate.
                    </p>
                )}
                {recentRatings.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-2">
                        {recentRatings.map((r: any) => (
                            <li
                                key={String(r._id)}
                                className="rounded-2xl border-[1.5px] border-border bg-card px-4 py-3"
                            >
                                <span aria-hidden="true" className="text-xs text-amber-500">
                                    {"★".repeat(r.stars)}
                                </span>
                                <p className="mt-1 text-sm">{r.comment}</p>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
