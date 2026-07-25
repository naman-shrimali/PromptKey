import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import dbConnect from "@/lib/db";
import { CatalogPrompt, User } from "@/lib/models";
import { decrypt } from "@/lib/encryption";
import { saveCatalogPrompt, togglePublish, deleteCatalogPrompt } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

const inr = (paise: number | null) =>
    paise == null ? "default" : `₹${(paise / 100).toLocaleString("en-IN")}`;

const input =
    "h-10 w-full rounded-xl border-[1.5px] border-border bg-card px-3 text-sm outline-none focus:border-ring";
const label = "block text-xs font-semibold text-muted-foreground";
const pill =
    "cursor-pointer rounded-full border-[1.5px] border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:border-ring hover:text-foreground";

// Minimal admin CRUD (SPEC §5 M5): plain forms, no CMS.
export default async function AdminMarketPage({
    searchParams,
}: {
    searchParams: Promise<{ edit?: string; error?: string }>;
}) {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");
    await dbConnect();
    const me = await User.findById(session.user.id).select("role");
    if (me?.role !== "admin") redirect("/");

    const { edit, error } = await searchParams;
    const prompts = await CatalogPrompt.find({}).sort({ updatedAt: -1 });

    const editing: any = edit ? prompts.find((p: any) => String(p._id) === edit) : null;
    // Admin sees plaintext variants for editing — decrypt server-side.
    const editingVariants = editing
        ? (editing.variants ?? []).map((v: any) => ({
              model: v.model,
              modelLabel: v.modelLabel,
              content: decrypt(v.iv, v.content, v.authTag),
          }))
        : [];

    return (
        <div className="mx-auto w-full max-w-[880px] px-5 pb-20 pt-4">
            <h1 className="font-display text-2xl font-bold">Market admin</h1>
            {error && (
                <p role="alert" className="mt-2 text-sm font-semibold text-destructive">
                    {error}
                </p>
            )}

            {/* List */}
            <div className="mt-5 flex flex-col gap-2">
                {prompts.map((p: any) => (
                    <div
                        key={String(p._id)}
                        className="flex flex-wrap items-center gap-2 rounded-2xl border-[1.5px] border-border bg-card px-4 py-3"
                    >
                        <span className={`size-2 rounded-full ${p.isPublished ? "bg-primary" : "bg-border"}`} />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                            {p.title}
                            <span className="ml-2 font-mono text-xs text-muted-foreground">
                                /{p.slug} · {p.category} · {inr(p.priceINR)} ·{" "}
                                {(p.variants ?? []).length} variant{(p.variants ?? []).length === 1 ? "" : "s"}
                            </span>
                        </span>
                        <Link href={`/admin/market?edit=${p._id}`} className={pill}>
                            Edit
                        </Link>
                        <form action={togglePublish}>
                            <input type="hidden" name="id" value={String(p._id)} />
                            <button type="submit" className={pill}>
                                {p.isPublished ? "Unpublish" : "Publish"}
                            </button>
                        </form>
                        <form action={deleteCatalogPrompt}>
                            <input type="hidden" name="id" value={String(p._id)} />
                            <button type="submit" className={`${pill} hover:border-destructive hover:text-destructive`}>
                                Delete
                            </button>
                        </form>
                    </div>
                ))}
                {prompts.length === 0 && (
                    <p className="text-sm text-muted-foreground">No catalog prompts yet — add one below.</p>
                )}
            </div>

            {/* Create / edit form */}
            <form
                action={saveCatalogPrompt}
                className="mt-8 flex flex-col gap-3 rounded-3xl border-[1.5px] border-border bg-card p-5"
            >
                <h2 className="font-display text-sm font-bold">
                    {editing ? `Edit: ${editing.title}` : "New catalog prompt"}
                </h2>
                {editing && <input type="hidden" name="id" value={String(editing._id)} />}
                <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                        <span className={label}>Slug (kebab-case)</span>
                        <input name="slug" required defaultValue={editing?.slug ?? ""} placeholder="cold-email-writer" className={input} />
                    </div>
                    <div>
                        <span className={label}>Title</span>
                        <input name="title" required defaultValue={editing?.title ?? ""} className={input} />
                    </div>
                    <div>
                        <span className={label}>Category</span>
                        <input name="category" required defaultValue={editing?.category ?? ""} placeholder="writing / coding / marketing / research" className={input} />
                    </div>
                    <div>
                        <span className={label}>Price in ₹ (blank = default)</span>
                        <input name="priceINR" type="number" step="1" min="1" defaultValue={editing?.priceINR != null ? editing.priceINR / 100 : ""} className={input} />
                    </div>
                </div>
                <div>
                    <span className={label}>Description</span>
                    <textarea name="description" rows={2} defaultValue={editing?.description ?? ""} className={`${input} h-auto py-2`} />
                </div>
                <div>
                    <span className={label}>Preview teaser (free, ~200 chars + sample output)</span>
                    <textarea name="previewText" rows={3} defaultValue={editing?.previewText ?? ""} className={`${input} h-auto py-2 font-mono text-xs`} />
                </div>
                <div>
                    <span className={label}>
                        Variants — JSON array of {"{ model, modelLabel, content }"} (model: claude | gpt | gemini | llama | generic)
                    </span>
                    <textarea
                        name="variants"
                        rows={8}
                        defaultValue={JSON.stringify(editingVariants, null, 2)}
                        placeholder='[{"model":"claude","modelLabel":"Claude Sonnet","content":"…"}]'
                        className={`${input} h-auto py-2 font-mono text-xs`}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="submit"
                        className="cursor-pointer rounded-2xl bg-primary px-6 py-2.5 font-display text-sm font-semibold text-primary-foreground"
                    >
                        {editing ? "Save changes" : "Create"}
                    </button>
                    {editing && (
                        <Link href="/admin/market" className={pill}>
                            Cancel edit
                        </Link>
                    )}
                    <span className="text-xs text-muted-foreground">
                        Content is encrypted at rest on save.
                    </span>
                </div>
            </form>
        </div>
    );
}
