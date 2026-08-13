import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { Prompt } from "@/lib/models";
import { decrypt } from "@/lib/encryption";
import { resolveApiUserId, corsHeaders, preflight } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
    return preflight(request);
}

/**
 * GET /api/prompts/:slug — full record including plaintext, owner only
 * (SPEC §6).
 *
 * Deliberately distinct from the public /{slug}/raw route: this is the
 * owner reading their own library, so it must NOT count a scan and must
 * NOT consume a one-time view. Browsing your library shouldn't burn a
 * one-time prompt or inflate its analytics.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const cors = corsHeaders(request);
    try {
        const { slug } = await params;
        await dbConnect();

        const userId = await resolveApiUserId(request);
        if (!userId) {
            return NextResponse.json(
                { error: { code: "unauthorized", message: "Sign in or pass a Bearer token" } },
                { status: 401, headers: cors }
            );
        }

        const prompt = await Prompt.findOne({
            shortSlug: slug,
            ownerUserId: userId,
            deletedAt: null,
        });
        if (!prompt) {
            return NextResponse.json(
                { error: { code: "not_found", message: "No such prompt in your library" } },
                { status: 404, headers: cors }
            );
        }

        const base = {
            slug: prompt.shortSlug,
            title: prompt.title,
            charCount: prompt.charCount,
            scanCount: prompt.scanCount,
            isFavorite: prompt.isFavorite,
            isOneTimeView: prompt.isOneTimeView,
            e2e: !!prompt.e2e,
            tags: prompt.tags,
            createdAt: prompt.createdAt,
            expiresAt: prompt.expiresAt,
        };

        // End-to-end encrypted prompts have no server-side plaintext — the
        // key never left the creator's browser (SPEC §5 M4).
        if (prompt.e2e) {
            return NextResponse.json(
                { data: { ...base, content: null, contentUnavailable: "e2e" } },
                { headers: cors }
            );
        }

        let content: string;
        try {
            content = decrypt(prompt.iv, prompt.encryptedContent, prompt.authTag);
        } catch {
            return NextResponse.json(
                { data: { ...base, content: null, contentUnavailable: "undecryptable" } },
                { headers: cors }
            );
        }

        return NextResponse.json({ data: { ...base, content } }, { headers: cors });
    } catch (error) {
        console.error("GET /api/prompts/:slug failed:", error);
        return NextResponse.json(
            { error: { code: "internal", message: "Something went wrong" } },
            { status: 500, headers: cors }
        );
    }
}
