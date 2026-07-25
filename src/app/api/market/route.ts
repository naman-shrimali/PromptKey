import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { CatalogPrompt } from "@/lib/models";
import { serializeCatalogPrompt } from "@/lib/market-access";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

// GET /api/market — public catalog list, previews only (SPEC §6).
// ?category=&model=&sort=rating|newest|price
export async function GET(request: Request) {
    await dbConnect();
    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const model = url.searchParams.get("model");
    const sort = url.searchParams.get("sort") ?? "rating";

    const filter: Record<string, unknown> = { isPublished: true };
    if (category) filter.category = category;
    if (model) filter["variants.model"] = model;

    const sortSpec: Record<string, 1 | -1> =
        sort === "newest"
            ? { publishedAt: -1 }
            : sort === "price"
              ? { priceINR: 1 }
              : { ratingAvg: -1, ratingCount: -1 };

    const prompts = await CatalogPrompt.find(filter).sort(sortSpec).limit(100);

    return NextResponse.json({
        data: { items: prompts.map((p: any) => serializeCatalogPrompt(p, false)) },
    });
}
