import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { resolveApiUserId } from "@/lib/api-auth";
import {
    findPublishedCatalogPrompt,
    hasAccessToPrompt,
    serializeCatalogPrompt,
} from "@/lib/market-access";

export const dynamic = "force-dynamic";

// GET /api/market/:slug — detail; variant content ONLY with access (SPEC §6).
export async function GET(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;
    await dbConnect();

    const prompt = await findPublishedCatalogPrompt(slug);
    if (!prompt) {
        return NextResponse.json(
            { error: { code: "not_found", message: "No such catalog prompt" } },
            { status: 404 }
        );
    }

    const userId = await resolveApiUserId(request);
    const access = await hasAccessToPrompt(userId, prompt);

    return NextResponse.json({ data: serializeCatalogPrompt(prompt, access) });
}
