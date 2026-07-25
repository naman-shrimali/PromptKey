import Link from "next/link";
import { auth } from "@/auth";
import dbConnect from "@/lib/db";
import { Prompt } from "@/lib/models";
import { escapeRegex } from "@/lib/living-qr";
import { ClaimGuestPrompts } from "@/components/dashboard/claim-guest-prompts";
import { PromptRow, type PromptRowData } from "@/components/dashboard/prompt-row";

export const dynamic = "force-dynamic";

type Search = { q?: string; tag?: string; favorite?: string };

async function getPrompts(userId: string, { q, tag, favorite }: Search) {
    await dbConnect();
    const filter: Record<string, unknown> = { ownerUserId: userId, deletedAt: null };
    // Server-side search on the plaintext title only (SPEC §5 M2) —
    // content is encrypted at rest and never searchable.
    if (q) filter.title = { $regex: escapeRegex(q), $options: "i" };
    if (tag) filter.tags = tag;
    if (favorite === "1") filter.isFavorite = true;
    return Prompt.find(filter).sort({ createdAt: -1 }).limit(100).lean();
}

export default async function DashboardPage({
    searchParams,
}: {
    searchParams: Promise<Search>;
}) {
    const session = await auth();
    const params = await searchParams;
    const prompts = await getPrompts(session!.user!.id as string, params);

    const allTags: string[] = [
        ...new Set(prompts.flatMap((p) => (p.tags as string[]) ?? [])),
    ].slice(0, 12);

    const rows: PromptRowData[] = prompts.map((p) => ({
        id: String(p._id),
        slug: p.shortSlug as string,
        title: (p.title as string) || "(untitled)",
        charCount: (p.charCount as number) ?? 0,
        scanCount: (p.scanCount as number) ?? 0,
        createdAt: new Date(p.createdAt as Date).toLocaleDateString("en", {
            month: "short",
            day: "numeric",
        }),
        isFavorite: !!p.isFavorite,
        isOneTimeView: !!p.isOneTimeView,
        editedCount: ((p.versions as unknown[]) ?? []).length,
        expired: !!p.expiresAt && new Date(p.expiresAt as Date) <= new Date(),
        tags: (p.tags as string[]) ?? [],
    }));

    const filterHref = (patch: Partial<Search>) => {
        const next = new URLSearchParams();
        const merged = { ...params, ...patch };
        for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
        const qs = next.toString();
        return qs ? `/dashboard?${qs}` : "/dashboard";
    };

    return (
        <div className="mx-auto w-full max-w-[880px] px-5 pb-20 pt-4">
            <ClaimGuestPrompts />

            <div className="flex items-center gap-3">
                <h1 className="font-display text-2xl font-bold">Your library</h1>
                <span className="text-sm text-muted-foreground">{rows.length}</span>
                <span className="flex-1" />
                <Link
                    href="/"
                    className="rounded-full bg-primary px-5 py-2.5 font-display text-sm font-semibold text-primary-foreground shadow-[0_4px_14px_color-mix(in_srgb,var(--primary)_35%,transparent)]"
                >
                    + New QR
                </Link>
            </div>

            {/* Search + filters */}
            <form action="/dashboard" className="mt-5 flex flex-wrap items-center gap-2">
                <input
                    type="search"
                    name="q"
                    defaultValue={params.q ?? ""}
                    placeholder="Search titles…"
                    className="h-11 min-w-0 flex-1 rounded-2xl border-[1.5px] border-border bg-card px-4 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
                />
                {params.tag && <input type="hidden" name="tag" value={params.tag} />}
                {params.favorite && <input type="hidden" name="favorite" value={params.favorite} />}
                <button
                    type="submit"
                    className="h-11 cursor-pointer rounded-2xl border-[1.5px] border-border bg-card px-5 text-sm font-semibold text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
                >
                    Search
                </button>
                <Link
                    href={filterHref({ favorite: params.favorite === "1" ? undefined : "1" })}
                    className={`flex h-11 items-center rounded-2xl border-[1.5px] px-4 text-sm font-semibold transition-colors ${
                        params.favorite === "1"
                            ? "border-ring bg-accent"
                            : "border-border bg-card text-muted-foreground hover:border-ring"
                    }`}
                >
                    ★ Favorites
                </Link>
            </form>

            {allTags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {allTags.map((tag) => (
                        <Link
                            key={tag}
                            href={filterHref({ tag: params.tag === tag ? undefined : tag })}
                            className={`rounded-full border-[1.5px] px-3 py-1 text-xs font-semibold ${
                                params.tag === tag
                                    ? "border-ring bg-accent"
                                    : "border-border bg-card text-muted-foreground hover:border-ring"
                            }`}
                        >
                            #{tag}
                        </Link>
                    ))}
                </div>
            )}

            {/* The list (not a grid — SPEC §5 M2) */}
            <div className="mt-5 flex flex-col gap-2.5">
                {rows.length === 0 ? (
                    <div className="rounded-3xl border-[1.5px] border-dashed border-border bg-card px-8 py-16 text-center">
                        <p aria-hidden="true" className="text-4xl">
                            🗂️
                        </p>
                        <h2 className="mt-3 font-display text-lg font-bold">
                            {params.q || params.tag || params.favorite
                                ? "Nothing matches those filters"
                                : "No QR codes yet"}
                        </h2>
                        <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
                            {params.q || params.tag || params.favorite
                                ? "Try clearing the search or filters."
                                : "Make your first QR and it will show up here."}
                        </p>
                        <Link
                            href="/"
                            className="mt-6 inline-block rounded-2xl bg-primary px-7 py-3 font-display text-sm font-semibold text-primary-foreground"
                        >
                            Make a QR →
                        </Link>
                    </div>
                ) : (
                    rows.map((row) => <PromptRow key={row.id} row={row} />)
                )}
            </div>
        </div>
    );
}
