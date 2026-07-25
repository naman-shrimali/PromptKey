import { NextResponse } from "next/server";
import { z } from "zod";
import dbConnect from "@/lib/db";
import { Prompt } from "@/lib/models";
import { createPromptRecord, createE2ePromptRecord } from "@/lib/create-prompt";
import { resolveApiUserId, corsHeaders, preflight } from "@/lib/api-auth";
import { EXPIRY_PRESETS } from "@/lib/qr-mode";
import { MAX_CHARS } from "@/lib/config";

export const dynamic = "force-dynamic";

// JSON API for the extension and future clients (SPEC §6).
// Envelope: { data } | { error: { code, message } }.

function appUrl(request: Request): string {
    return (
        process.env.NEXT_PUBLIC_APP_URL ||
        new URL(request.url).origin
    ).replace(/\/$/, "");
}

export function OPTIONS(request: Request) {
    return preflight(request);
}

// SPEC §6 body: { content, expiresIn?, oneTime?, e2e?, ciphertext? } —
// plaintext content and e2e ciphertext are mutually exclusive shapes.
const createSchema = z.union([
    z.object({
        content: z.string().min(1).max(MAX_CHARS),
        expiresIn: z.enum(EXPIRY_PRESETS).optional(),
        oneTime: z.boolean().optional(),
        e2e: z.literal(false).optional(),
    }),
    z.object({
        e2e: z.literal(true),
        ciphertext: z.string().min(20),
        iv: z.string().min(10).max(32),
        charCount: z.number().int().min(0).max(MAX_CHARS).optional(),
        expiresIn: z.enum(EXPIRY_PRESETS).optional(),
        oneTime: z.boolean().optional(),
    }),
]);

// POST /api/prompts — create (auth optional; guests are rate-limited by IP)
export async function POST(request: Request) {
    const cors = corsHeaders(request);
    try {
        await dbConnect();
        const userId = await resolveApiUserId(request);

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            body = null;
        }
        const parsed = createSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: {
                        code: "invalid",
                        message:
                            "Body must be { content, expiresIn?, oneTime? } or { e2e: true, ciphertext, iv, charCount?, expiresIn?, oneTime? }",
                    },
                },
                { status: 400, headers: cors }
            );
        }

        const clientIp = (request.headers.get("x-forwarded-for") || "unknown")
            .split(",")[0]
            .trim();

        const result =
            "ciphertext" in parsed.data
                ? await createE2ePromptRecord({
                      ciphertext: parsed.data.ciphertext,
                      iv: parsed.data.iv,
                      charCount: parsed.data.charCount,
                      isOneTimeView: parsed.data.oneTime,
                      expiresIn: parsed.data.expiresIn,
                      userId,
                      clientIp,
                  })
                : await createPromptRecord({
                      content: parsed.data.content,
                      isOneTimeView: parsed.data.oneTime,
                      expiresIn: parsed.data.expiresIn,
                      userId,
                      clientIp,
                  });

        if ("error" in result) {
            return NextResponse.json(
                { error: { code: result.code, message: result.error } },
                { status: result.code === "rate_limited" ? 429 : 400, headers: cors }
            );
        }

        return NextResponse.json(
            {
                data: {
                    slug: result.slug,
                    url: `${appUrl(request)}/${result.slug}`,
                    claimToken: result.claimToken ?? undefined,
                    expiresAt: result.expiresAt,
                },
            },
            { status: 201, headers: cors }
        );
    } catch (error) {
        console.error("POST /api/prompts failed:", error);
        return NextResponse.json(
            { error: { code: "internal", message: "Something went wrong" } },
            { status: 500, headers: cors }
        );
    }
}

// GET /api/prompts — list own (auth required; ?limit=&cursor=&q=)
export async function GET(request: Request) {
    const cors = corsHeaders(request);
    try {
        await dbConnect();
        const userId = await resolveApiUserId(request);
        if (!userId) {
            return NextResponse.json(
                { error: { code: "unauthorized", message: "Sign in or pass a Bearer token" } },
                { status: 401, headers: cors }
            );
        }

        const url = new URL(request.url);
        const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 20, 1), 50);
        const cursor = url.searchParams.get("cursor");

        const filter: Record<string, unknown> = { ownerUserId: userId, deletedAt: null };
        if (cursor) {
            const cursorDate = new Date(cursor);
            if (!Number.isNaN(cursorDate.getTime())) filter.createdAt = { $lt: cursorDate };
        }

        const prompts = await Prompt.find(filter)
            .sort({ createdAt: -1 })
            .limit(limit + 1)
            .select("shortSlug title charCount scanCount isFavorite isOneTimeView tags createdAt expiresAt")
            .lean();

        const hasMore = prompts.length > limit;
        const page = prompts.slice(0, limit);
        const base = appUrl(request);

        return NextResponse.json(
            {
                data: {
                    items: page.map((p) => ({
                        slug: p.shortSlug,
                        url: `${base}/${p.shortSlug}`,
                        title: p.title,
                        charCount: p.charCount,
                        scanCount: p.scanCount,
                        isFavorite: p.isFavorite,
                        isOneTimeView: p.isOneTimeView,
                        tags: p.tags,
                        createdAt: p.createdAt,
                        expiresAt: p.expiresAt,
                    })),
                    nextCursor: hasMore ? new Date(page[page.length - 1].createdAt as Date).toISOString() : null,
                },
            },
            { headers: cors }
        );
    } catch (error) {
        console.error("GET /api/prompts failed:", error);
        return NextResponse.json(
            { error: { code: "internal", message: "Something went wrong" } },
            { status: 500, headers: cors }
        );
    }
}
