import Link from "next/link";
import dbConnect from "@/lib/db";
import { CatalogPrompt } from "@/lib/models";
import { serializeCatalogPrompt } from "@/lib/market-access";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

const MODELS = ["claude", "gpt", "gemini", "llama", "generic"] as const;
const SORTS = [
    { key: "rating", label: "Top rated" },
    { key: "newest", label: "Newest" },
    { key: "price", label: "Price" },
] as const;

const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;

function Stars({ avg, count }: { avg: number; count: number }) {
    if (count === 0) return <span className="text-xs text-muted-foreground">No ratings yet</span>;
    return (
        <span className="text-xs text-muted-foreground">
            <span aria-hidden="true" className="text-amber-500">
                {"★".repeat(Math.round(avg))}
                {"☆".repeat(5 - Math.round(avg))}
            </span>{" "}
            {avg.toFixed(1)} ({count})
        </span>
    );
}

type Search = { category?: string; model?: string; sort?: string };

export default async function MarketPage({
    searchParams,
}: {
    searchParams: Promise<Search>;
}) {
    const params = await searchParams;
    await dbConnect();

    const filter: Record<string, unknown> = { isPublished: true };
    if (params.category) filter.category = params.category;
    if (params.model) filter["variants.model"] = params.model;
    const sortSpec: Record<string, 1 | -1> =
        params.sort === "newest"
            ? { publishedAt: -1 }
            : params.sort === "price"
              ? { priceINR: 1 }
              : { ratingAvg: -1, ratingCount: -1 };

    const docs = await CatalogPrompt.find(filter).sort(sortSpec).limit(100);
    const items = docs.map((d: any) => serializeCatalogPrompt(d, false));
    const categories = await CatalogPrompt.distinct("category", { isPublished: true });

    const href = (patch: Partial<Search>) => {
        const merged = { ...params, ...patch };
        const qs = new URLSearchParams();
        for (const [k, v] of Object.entries(merged)) if (v) qs.set(k, v);
        const s = qs.toString();
        return s ? `/market?${s}` : "/market";
    };

    const chip = (active: boolean) =>
        `rounded-full border-[1.5px] px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
            active
                ? "border-ring bg-accent text-foreground"
                : "border-border bg-card text-muted-foreground hover:border-ring"
        }`;

    return (
        <div className="mx-auto w-full max-w-[1060px] px-5 pb-20 pt-6">
            <h1 className="font-display text-3xl font-bold">Prompt market</h1>
            <p className="mt-1 text-sm text-muted-foreground">
                Expert-written prompts, tuned per model. Subscribe for everything, or buy one at a
                time.
            </p>

            {/* Filters */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
                {categories.map((c: string) => (
                    <Link key={c} href={href({ category: params.category === c ? undefined : c })} className={chip(params.category === c)}>
                        {c}
                    </Link>
                ))}
                <span className="mx-1 h-5 w-px bg-border" />
                {MODELS.map((m) => (
                    <Link key={m} href={href({ model: params.model === m ? undefined : m })} className={chip(params.model === m)}>
                        {m}
                    </Link>
                ))}
                <span className="flex-1" />
                {SORTS.map((s) => (
                    <Link key={s.key} href={href({ sort: s.key })} className={chip((params.sort ?? "rating") === s.key)}>
                        {s.label}
                    </Link>
                ))}
            </div>

            {/* Grid */}
            {items.length === 0 ? (
                <div className="mt-8 rounded-3xl border-[1.5px] border-dashed border-border bg-card px-8 py-16 text-center">
                    <p aria-hidden="true" className="text-4xl">
                        🛍️
                    </p>
                    <h2 className="mt-3 font-display text-lg font-bold">Nothing here yet</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {params.category || params.model
                            ? "Try clearing the filters."
                            : "The catalog is being stocked — check back soon."}
                    </p>
                </div>
            ) : (
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((item: any) => (
                        <Link
                            key={item.slug}
                            href={`/market/${item.slug}`}
                            className="group rounded-3xl border-[1.5px] border-border bg-card p-5 transition-colors hover:border-ring"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                                    {item.category}
                                </span>
                                <span className="font-display text-base font-bold text-primary">
                                    {inr(item.priceINR)}
                                </span>
                            </div>
                            <h2 className="mt-3 font-display text-lg font-bold leading-snug group-hover:text-primary">
                                {item.title}
                            </h2>
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                                {item.description}
                            </p>
                            <div className="mt-3 flex items-center justify-between gap-2">
                                <Stars avg={item.ratingAvg} count={item.ratingCount} />
                                <span className="flex gap-1">
                                    {item.models.map((m: any) => (
                                        <span
                                            key={m.model}
                                            title={m.modelLabel}
                                            className="rounded-full border-[1.5px] border-border px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground"
                                        >
                                            {m.model}
                                        </span>
                                    ))}
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
