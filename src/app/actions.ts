"use server";

import { z } from "zod";
import dbConnect from "@/lib/db";
import { Prompt, RateLimit } from "@/lib/models";
import { encrypt } from "@/lib/encryption";
import { nanoid } from "@/lib/nanoid";
import { headers } from "next/headers";
import { auth } from "@/auth";

const generateSchema = z.object({
    content: z.string().min(1, "Content is required").max(10000, "Content is too long"),
    isOneTimeView: z.boolean().optional(),
});

export async function generatePrompt(prevState: any, formData: FormData) {
    try {
        const content = formData.get("content");
        const isOneTimeView = formData.get("isOneTimeView") === "on";

        const validatedFields = generateSchema.safeParse({
            content,
            isOneTimeView,
        });

        if (!validatedFields.success) {
            return {
                error: validatedFields.error.flatten().fieldErrors,
            };
        }

        const session = await auth();

        await dbConnect();

        // Rate Limiting
        const headersList = await headers();
        const ip = headersList.get("x-forwarded-for") || "unknown";
        const clientIp = ip.split(",")[0].trim();

        const limit = 10;
        const windowMs = 60 * 60 * 1000; // 1 hour

        const rateLimit = await RateLimit.findOne({ ip: clientIp, action: "generate" });

        if (rateLimit) {
            if (rateLimit.count >= limit) {
                return { error: "Rate limit exceeded. Please try again later." };
            }
            await RateLimit.updateOne({ _id: rateLimit._id }, { $inc: { count: 1 } });
        } else {
            await RateLimit.create({
                ip: clientIp,
                action: "generate",
                count: 1,
                expiresAt: new Date(Date.now() + windowMs)
            });
        }

        const { iv, content: encryptedContent } = encrypt(validatedFields.data.content);
        const shortSlug = nanoid();

        const prompt = await Prompt.create({
            shortSlug,
            encryptedContent,
            iv,
            ownerUserId: session?.user?.id,
            isGuest: !session?.user,
            options: {
                isOneTimeView: validatedFields.data.isOneTimeView,
            },
        });

        return {
            success: true,
            slug: prompt.shortSlug,
        };
    } catch (error) {
        console.error("Failed to generate prompt:", error);
        return {
            error: "Failed to generate prompt. Please try again.",
        };
    }
}

export async function deletePrompt(formData: FormData) {
    const session = await auth();
    if (!session?.user) return;

    const id = formData.get("id");
    await dbConnect();
    await Prompt.deleteOne({ _id: id, ownerUserId: session.user.id });

    // Revalidate path if needed, but for now we rely on page refresh or client update
    // revalidatePath("/dashboard");
}
