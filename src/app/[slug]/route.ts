import { headers } from "next/headers";
import { after } from "next/server";
import dbConnect from "@/lib/db";
import { resolveScan, recordScan, isBotRequest } from "@/lib/scan";
import { renderScanPage, renderGonePage } from "@/lib/scan-html";

export const dynamic = "force-dynamic";

// GET /{slug} — the scan page, served as plain HTML from a route handler.
// Rendering without React keeps the page at zero framework JS (SPEC §5.2
// perf budget) and lets us return real 404/410 status codes.

const HTML_HEADERS = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow",
} as const;

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;

    const headersList = await headers();
    const isBot = isBotRequest(
        headersList.get("user-agent"),
        headersList.get("sec-purpose") || headersList.get("purpose")
    );

    await dbConnect();
    const result = await resolveScan(slug, { consumeOneTime: !isBot });

    if (result.status !== "ok") {
        // Same honest page either way; the status code tells machines the truth.
        return new Response(renderGonePage(), {
            status: result.status === "not_found" ? 404 : 410,
            headers: HTML_HEADERS,
        });
    }

    const { prompt, content } = result;

    // Count the scan without blocking the render; skip previews/crawlers
    // (SPEC §2, §8). One-time views were already counted by the claim.
    if (!prompt.isOneTimeView && !isBot) {
        after(() => recordScan(prompt._id));
    }

    const html = renderScanPage({
        slug,
        content,
        charCount: prompt.charCount || [...content].length,
        createdAt: prompt.createdAt ?? new Date(),
        isOneTimeView: !!prompt.isOneTimeView,
    });

    return new Response(html, { status: 200, headers: HTML_HEADERS });
}
