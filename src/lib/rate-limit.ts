import { RateLimit } from "./models";

/**
 * Atomic sliding-window-ish rate limit: one findOneAndUpdate does the
 * check *and* the increment, so concurrent requests can't both slip
 * under the limit (SPEC §2). An expired window is reset in the same
 * atomic pipeline rather than trusting the TTL monitor's timing.
 */
export async function consumeRateLimit(
    key: string,
    action: string,
    limit: number,
    windowMs: number
): Promise<{ allowed: boolean; remaining: number }> {
    const expiresAt = new Date(Date.now() + windowMs);

    const windowExpired = {
        $or: [
            { $eq: [{ $type: "$expiresAt" }, "missing"] },
            { $lt: ["$expiresAt", "$$NOW"] },
        ],
    };

    const update = [
        {
            $set: {
                count: {
                    $cond: [windowExpired, 1, { $add: [{ $ifNull: ["$count", 0] }, 1] }],
                },
                expiresAt: {
                    $cond: [windowExpired, expiresAt, "$expiresAt"],
                },
            },
        },
    ];

    let doc;
    try {
        doc = await RateLimit.findOneAndUpdate({ ip: key, action }, update, {
            upsert: true,
            new: true,
            updatePipeline: true,
        });
    } catch (error: unknown) {
        // Two concurrent upserts can race on the unique (ip, action) index;
        // the loser retries once and increments the winner's doc.
        if ((error as { code?: number })?.code === 11000) {
            doc = await RateLimit.findOneAndUpdate({ ip: key, action }, update, {
                upsert: true,
                new: true,
                updatePipeline: true,
            });
        } else {
            throw error;
        }
    }

    return {
        allowed: doc.count <= limit,
        remaining: Math.max(0, limit - doc.count),
    };
}
