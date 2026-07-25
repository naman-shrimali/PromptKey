import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import dbConnect from "@/lib/db";
import { claimPrompts } from "@/lib/claim";

const bodySchema = z.object({
    claims: z
        .array(z.object({ slug: z.string().min(1), claimToken: z.string().min(1) }))
        .min(1)
        .max(100),
});

// POST /api/claim — attach guest-created prompts to the signed-in user
// (SPEC §5 M2). The claimToken proves the caller created the prompt.
export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json(
            { error: { code: "unauthorized", message: "Sign in to claim prompts" } },
            { status: 401 }
        );
    }

    let parsed;
    try {
        parsed = bodySchema.safeParse(await request.json());
    } catch {
        parsed = { success: false as const, error: null };
    }
    if (!parsed.success) {
        return NextResponse.json(
            { error: { code: "bad_request", message: "Expected { claims: [{ slug, claimToken }] }" } },
            { status: 400 }
        );
    }

    await dbConnect();
    const claimed = await claimPrompts(session.user.id, parsed.data.claims);

    return NextResponse.json({ data: { claimed } });
}
