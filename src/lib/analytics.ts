import mongoose from "mongoose";
import { ScanEvent } from "./models";

export type PromptAnalytics = {
    daily: Array<{ date: string; label: string; count: number }>; // last 14 days, zero-filled
    devices: { mobile: number; desktop: number };
    referrers: Array<{ host: string; count: number }>; // top 5, 30 days
    total30d: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Owner-facing per-prompt analytics (SPEC §5 M4). Caller checks ownership. */
export async function getPromptAnalytics(promptId: string): Promise<PromptAnalytics> {
    const id = new mongoose.Types.ObjectId(promptId);
    const since30d = new Date(Date.now() - 30 * DAY_MS);
    // Day buckets are UTC on both sides: $dateToString groups in UTC,
    // so the zero-filled keys must be UTC days too.
    const now = new Date();
    const todayUtcStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const since14d = new Date(todayUtcStart - 13 * DAY_MS);

    const [dailyRows, deviceRows, referrerRows] = await Promise.all([
        ScanEvent.aggregate([
            { $match: { promptId: id, at: { $gte: since14d } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$at" } },
                    count: { $sum: 1 },
                },
            },
        ]),
        ScanEvent.aggregate([
            { $match: { promptId: id, at: { $gte: since30d } } },
            { $group: { _id: "$deviceClass", count: { $sum: 1 } } },
        ]),
        ScanEvent.aggregate([
            { $match: { promptId: id, at: { $gte: since30d }, referrer: { $ne: "" } } },
            { $group: { _id: "$referrer", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
        ]),
    ]);

    const byDay = new Map<string, number>(dailyRows.map((r) => [r._id, r.count]));
    const daily: PromptAnalytics["daily"] = [];
    for (let i = 13; i >= 0; i--) {
        const day = new Date(todayUtcStart - i * DAY_MS);
        const key = day.toISOString().slice(0, 10);
        daily.push({
            date: key,
            label: day.toLocaleDateString("en", {
                month: "short",
                day: "numeric",
                timeZone: "UTC",
            }),
            count: byDay.get(key) ?? 0,
        });
    }

    const devices = { mobile: 0, desktop: 0 };
    for (const row of deviceRows) {
        if (row._id === "mobile") devices.mobile = row.count;
        else devices.desktop += row.count;
    }

    return {
        daily,
        devices,
        referrers: referrerRows.map((r) => ({ host: r._id, count: r.count })),
        total30d: devices.mobile + devices.desktop,
    };
}
