import { Prompt } from "./models";

/**
 * Attach guest prompts to an account (SPEC §5 M2). The claimToken is a
 * bearer proof of creation: only exact (slug, token) pairs still marked
 * as guest are claimable. Returns how many were attached.
 */
export async function claimPrompts(
    userId: string,
    claims: Array<{ slug: string; claimToken: string }>
): Promise<number> {
    let claimed = 0;
    for (const { slug, claimToken } of claims) {
        const res = await Prompt.updateOne(
            { shortSlug: slug, claimToken, isGuest: true, deletedAt: null },
            { $set: { ownerUserId: userId, isGuest: false, claimToken: null } }
        );
        claimed += res.modifiedCount;
    }
    return claimed;
}
