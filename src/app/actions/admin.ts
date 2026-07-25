"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import dbConnect from "@/lib/db";
import { CatalogPrompt, User } from "@/lib/models";
import { encrypt } from "@/lib/encryption";

/* eslint-disable @typescript-eslint/no-explicit-any */

async function requireAdmin(): Promise<string> {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");
    await dbConnect();
    const user = await User.findById(session.user.id).select("role");
    // Admin-only surface (SPEC §5 M5) — everyone else sees a 404-ish redirect.
    if (user?.role !== "admin") redirect("/");
    return session.user.id;
}

const variantSchema = z.array(
    z.object({
        model: z.enum(["claude", "gpt", "gemini", "llama", "generic"]),
        modelLabel: z.string().trim().min(1).max(60),
        content: z.string().min(1).max(50_000),
    })
).max(5);

const promptSchema = z.object({
    slug: z
        .string()
        .trim()
        .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug must be kebab-case"),
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000),
    category: z.string().trim().min(1).max(40),
    previewText: z.string().max(1000),
    priceINR: z.number().int().min(100).max(10_000_000).nullable(),
});

export async function saveCatalogPrompt(formData: FormData) {
    await requireAdmin();

    const id = String(formData.get("id") || "");
    const priceRaw = String(formData.get("priceINR") || "").trim();

    const parsed = promptSchema.safeParse({
        slug: formData.get("slug"),
        title: formData.get("title"),
        description: formData.get("description") ?? "",
        category: String(formData.get("category") || "").toLowerCase(),
        previewText: formData.get("previewText") ?? "",
        priceINR: priceRaw ? Math.round(Number(priceRaw) * 100) : null, // form takes ₹
    });
    if (!parsed.success) {
        redirect(`/admin/market?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
    }

    let variantsInput: unknown;
    try {
        variantsInput = JSON.parse(String(formData.get("variants") || "[]"));
    } catch {
        redirect(`/admin/market?error=${encodeURIComponent("Variants must be valid JSON")}`);
    }
    const variants = variantSchema.safeParse(variantsInput);
    if (!variants.success) {
        redirect(
            `/admin/market?error=${encodeURIComponent("Variants: " + variants.error.issues[0].message)}`
        );
    }

    // Paid content is encrypted at rest with the same GCM helper (SPEC §4).
    const encryptedVariants = variants.data.map((v) => {
        const enc = encrypt(v.content);
        return {
            model: v.model,
            modelLabel: v.modelLabel,
            content: enc.content,
            iv: enc.iv,
            authTag: enc.authTag,
        };
    });

    const doc = { ...parsed.data, variants: encryptedVariants };
    if (id) {
        await CatalogPrompt.updateOne({ _id: id }, { $set: doc });
    } else {
        await CatalogPrompt.create(doc);
    }

    revalidatePath("/admin/market");
    revalidatePath("/market");
    redirect("/admin/market");
}

export async function togglePublish(formData: FormData) {
    await requireAdmin();
    const id = String(formData.get("id") || "");
    const prompt: any = await CatalogPrompt.findById(id);
    if (prompt) {
        const publishing = !prompt.isPublished;
        await CatalogPrompt.updateOne(
            { _id: id },
            {
                $set: {
                    isPublished: publishing,
                    ...(publishing && !prompt.publishedAt ? { publishedAt: new Date() } : {}),
                },
            }
        );
    }
    revalidatePath("/admin/market");
    revalidatePath("/market");
}

export async function deleteCatalogPrompt(formData: FormData) {
    await requireAdmin();
    await CatalogPrompt.deleteOne({ _id: String(formData.get("id") || "") });
    revalidatePath("/admin/market");
    revalidatePath("/market");
}
