"use server";

import crypto from "crypto";
import mongoose from "mongoose";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth, signOut } from "@/auth";
import dbConnect from "@/lib/db";
import { Prompt, User } from "@/lib/models";
import { sha256Hex } from "@/lib/encryption";

async function requireUserId(): Promise<string | null> {
    const session = await auth();
    return session?.user?.id ?? null;
}

export async function updateProfile(input: { name: string }) {
    const userId = await requireUserId();
    if (!userId) return { error: "Not signed in" };

    const parsed = z.object({ name: z.string().trim().min(1).max(60) }).safeParse(input);
    if (!parsed.success) return { error: "Name must be 1–60 characters" };

    await dbConnect();
    await User.updateOne({ _id: userId }, { $set: { name: parsed.data.name } });
    revalidatePath("/settings");
    return { success: true };
}

/**
 * API token for the extension (SPEC §4, M3 auth fallback). Only the
 * sha256 hash is stored; the plaintext is shown exactly once.
 */
export async function generateApiToken() {
    const userId = await requireUserId();
    if (!userId) return { error: "Not signed in" };

    const token = `pk_${crypto.randomBytes(24).toString("base64url")}`;
    await dbConnect();
    await User.updateOne({ _id: userId }, { $set: { apiToken: sha256Hex(token) } });
    revalidatePath("/settings");
    return { success: true, token };
}

export async function revokeApiToken() {
    const userId = await requireUserId();
    if (!userId) return { error: "Not signed in" };

    await dbConnect();
    await User.updateOne({ _id: userId }, { $set: { apiToken: null } });
    revalidatePath("/settings");
    return { success: true };
}

/**
 * Delete account (SPEC §5 M2): prompts are soft-deleted (TTL purges them
 * after 30 days), auth records are removed immediately, and the session
 * ends. No undo.
 */
export async function deleteAccount() {
    const userId = await requireUserId();
    if (!userId) return { error: "Not signed in" };

    await dbConnect();
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const db = mongoose.connection.db!;

    await Prompt.updateMany(
        { ownerUserId: userObjectId, deletedAt: null },
        { $set: { deletedAt: new Date() } }
    );
    // NextAuth adapter collections
    await db.collection("accounts").deleteMany({ userId: userObjectId });
    await db.collection("sessions").deleteMany({ userId: userObjectId });
    await db.collection("users").deleteOne({ _id: userObjectId });

    await signOut({ redirectTo: "/" });
}
