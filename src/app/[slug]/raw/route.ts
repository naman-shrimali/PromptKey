import { headers } from "next/headers";
import dbConnect from "@/lib/db";
import { resolveScan, recordScan, isBotRequest } from "@/lib/scan";
import { after } from "next/server";

export const dynamic = "force-dynamic";

const BASE_HEADERS = {
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow",
} as const;

// GET /{slug}/raw — text/plain body, curl-able (SPEC §5.2, §6).
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

    if (result.status === "not_found") {
        return new Response("Not found.\n", {
            status: 404,
            headers: { ...BASE_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
        });
    }
    if (result.status === "gone") {
        return new Response("Gone: this text expired or was a one-time view.\n", {
            status: 410,
            headers: { ...BASE_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
        });
    }

    if (!result.prompt.isOneTimeView && !isBot) {
        after(() => recordScan(result.prompt._id));
    }

    return new Response(result.content, {
        status: 200,
        headers: { ...BASE_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
    });
}
