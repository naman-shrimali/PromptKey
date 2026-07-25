import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import dbConnect from "@/lib/db";
import { Prompt } from "@/lib/models";
import { decrypt } from "@/lib/encryption";
import { PromptEditor } from "@/components/dashboard/prompt-editor";
import { PromptAnalyticsSection } from "@/components/dashboard/prompt-analytics";
import { getPromptAnalytics } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export default async function PromptDetailsPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const session = await auth();
    if (!session?.user) redirect("/login");

    const { id } = await params;
    await dbConnect();

    let prompt;
    try {
        prompt = await Prompt.findOne({
            _id: id,
            ownerUserId: session.user.id,
            deletedAt: null,
        });
    } catch {
        prompt = null; // malformed ObjectId
    }
    if (!prompt) notFound();

    // E2E prompts can't be edited server-side — the server never has the
    // plaintext (SPEC §5 M4). The editor shows a locked notice instead.
    let content = "";
    if (!prompt.e2e) {
        try {
            content = decrypt(prompt.iv, prompt.encryptedContent, prompt.authTag);
        } catch {
            content = "";
        }
    }

    const analytics = await getPromptAnalytics(String(prompt._id));

    const versions = (prompt.versions ?? []).map(
        (v: { editedAt?: Date }, index: number) => ({
            index,
            editedAt: v.editedAt
                ? new Date(v.editedAt).toLocaleString("en", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                  })
                : "unknown",
        })
    );

    return (
        <div className="mx-auto w-full max-w-[880px] px-5 pb-20 pt-4">
            <Link
                href="/dashboard"
                className="text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
                ← Back to library
            </Link>

            <PromptEditor
                prompt={{
                    id: String(prompt._id),
                    slug: prompt.shortSlug,
                    content,
                    e2e: !!prompt.e2e,
                    tags: prompt.tags ?? [],
                    scanCount: prompt.scanCount ?? 0,
                    isOneTimeView: !!prompt.isOneTimeView,
                    expiresAt: prompt.expiresAt ? prompt.expiresAt.toISOString() : null,
                    editedCount: (prompt.versions ?? []).length,
                    createdAt: new Date(prompt.createdAt).toLocaleDateString("en", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                    }),
                    versions,
                }}
            />

            <PromptAnalyticsSection analytics={analytics} />
        </div>
    );
}
