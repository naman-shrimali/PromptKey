import { NextResponse } from "next/server";
import { z } from "zod";
import dbConnect from "@/lib/db";
import { resolveApiUserId } from "@/lib/api-auth";
import { CatalogPrompt, Rating } from "@/lib/models";
import { findPublishedCatalogPrompt, hasAccessToPrompt } from "@/lib/market-access";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
    stars: z.number().int().min(1).max(5),
    comment: z.string().trim().max(500).optional(),
});

// POST /api/market/:slug/rate — upsert own rating; only users with
// access may rate; recompute avg/count on write (SPEC §5 M5).
export async function POST(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;
    await dbConnect();

    const userId = await resolveApiUserId(request);
    if (!userId) {
        return NextResponse.json(
            { error: { code: "unauthorized", message: "Sign in first" } },
            { status: 401 }
        );
    }

    const prompt = await findPublishedCatalogPrompt(slug);
    if (!prompt) {
        return NextResponse.json(
            { error: { code: "not_found", message: "No such catalog prompt" } },
            { status: 404 }
        );
    }

    if (!(await hasAccessToPrompt(userId, prompt))) {
        return NextResponse.json(
            { error: { code: "forbidden", message: "Only buyers and subscribers can rate" } },
            { status: 403 }
        );
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json(
            { error: { code: "invalid", message: "Body must be { stars: 1–5, comment? }" } },
            { status: 400 }
        );
    }

    await Rating.findOneAndUpdate(
        { userId, catalogPromptId: prompt._id },
        { $set: { stars: parsed.data.stars, comment: parsed.data.comment ?? "" } },
        { upsert: true }
    );

    const [agg] = await Rating.aggregate([
        { $match: { catalogPromptId: prompt._id } },
        { $group: { _id: null, avg: { $avg: "$stars" }, count: { $sum: 1 } } },
    ]);
    await CatalogPrompt.updateOne(
        { _id: prompt._id },
        {
            $set: {
                ratingAvg: Math.round((agg?.avg ?? 0) * 10) / 10,
                ratingCount: agg?.count ?? 0,
            },
        }
    );

    return NextResponse.json({
        data: { ratingAvg: Math.round((agg?.avg ?? 0) * 10) / 10, ratingCount: agg?.count ?? 0 },
    });
}
