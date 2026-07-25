import type { PromptAnalytics } from "@/lib/analytics";

// Server-rendered per-prompt analytics (SPEC §5 M4). Chart rules:
// single series → one validated hue (--primary passes contrast/CVD on
// both surfaces), no legend, text in ink tokens, 2px gaps between bars,
// rounded data ends, and a table fallback for accessibility.

export function PromptAnalyticsSection({ analytics }: { analytics: PromptAnalytics }) {
    const { daily, devices, referrers, total30d } = analytics;
    const max = Math.max(...daily.map((d) => d.count), 1);
    const peakIndex = daily.findIndex((d) => d.count === max);
    const maxReferrer = Math.max(...referrers.map((r) => r.count), 1);
    const devTotal = devices.mobile + devices.desktop;

    return (
        <section aria-label="Scan analytics" className="mt-8">
            <div className="flex items-baseline gap-3">
                <h2 className="font-display text-sm font-bold">Scans · last 14 days</h2>
                <span className="text-xs text-muted-foreground">{total30d} in the last 30 days</span>
            </div>

            {total30d === 0 ? (
                <p className="mt-3 rounded-2xl border-[1.5px] border-dashed border-border bg-card px-5 py-6 text-sm text-muted-foreground">
                    No scans recorded yet — analytics start collecting the moment someone opens
                    this QR. (Events are kept for 90 days.)
                </p>
            ) : (
                <div className="mt-3 rounded-2xl border-[1.5px] border-border bg-card p-5">
                    {/* Daily column chart */}
                    <div className="flex h-28 items-end gap-[2px]" role="img"
                        aria-label={`Daily scans, ${daily[0].label} to ${daily[daily.length - 1].label}, peak ${max}`}>
                        {daily.map((d, i) => (
                            <div key={d.date} className="relative flex h-full flex-1 flex-col justify-end" title={`${d.label}: ${d.count} scan${d.count === 1 ? "" : "s"}`}>
                                {i === peakIndex && d.count > 0 && (
                                    <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-muted-foreground">
                                        {d.count}
                                    </span>
                                )}
                                <div
                                    className="w-full rounded-t-[4px] bg-primary"
                                    style={{
                                        height: d.count === 0 ? "2px" : `${Math.max((d.count / max) * 100, 6)}%`,
                                        opacity: d.count === 0 ? 0.18 : 1,
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                    <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
                        <span>{daily[0].label}</span>
                        <span>{daily[daily.length - 1].label}</span>
                    </div>

                    {/* Device split + referrers */}
                    <div className="mt-5 grid gap-5 sm:grid-cols-2">
                        <div>
                            <h3 className="text-xs font-bold text-muted-foreground">Devices · 30 days</h3>
                            {devTotal > 0 && (
                                <>
                                    <div className="mt-2 flex h-2.5 gap-[2px] overflow-hidden rounded-full" role="img"
                                        aria-label={`${devices.mobile} mobile, ${devices.desktop} desktop`}>
                                        {devices.mobile > 0 && (
                                            <div className="bg-primary" style={{ width: `${(devices.mobile / devTotal) * 100}%` }} />
                                        )}
                                        {devices.desktop > 0 && (
                                            <div className="bg-primary opacity-40" style={{ width: `${(devices.desktop / devTotal) * 100}%` }} />
                                        )}
                                    </div>
                                    <p className="mt-1.5 text-xs text-muted-foreground">
                                        <span className="font-semibold text-foreground">📱 {devices.mobile}</span> mobile ·{" "}
                                        <span className="font-semibold text-foreground">🖥️ {devices.desktop}</span> desktop
                                    </p>
                                </>
                            )}
                        </div>
                        <div>
                            <h3 className="text-xs font-bold text-muted-foreground">Top referrers · 30 days</h3>
                            {referrers.length === 0 ? (
                                <p className="mt-2 text-xs text-muted-foreground">
                                    Direct scans only (camera apps send no referrer)
                                </p>
                            ) : (
                                <ul className="mt-2 flex flex-col gap-1.5">
                                    {referrers.map((r) => (
                                        <li key={r.host} className="flex items-center gap-2 text-xs" title={`${r.count} scans from ${r.host}`}>
                                            <span className="w-28 truncate font-mono">{r.host}</span>
                                            <span className="h-2 rounded-r-[4px] bg-primary" style={{ width: `${(r.count / maxReferrer) * 60}%`, minWidth: 4 }} />
                                            <span className="text-muted-foreground">{r.count}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    {/* Accessible table view */}
                    <details className="mt-4">
                        <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
                            View as table
                        </summary>
                        <table className="mt-2 w-full text-left text-xs">
                            <thead>
                                <tr className="text-muted-foreground">
                                    <th className="py-1 font-semibold">Day</th>
                                    <th className="py-1 font-semibold">Scans</th>
                                </tr>
                            </thead>
                            <tbody>
                                {daily.map((d) => (
                                    <tr key={d.date} className="border-t border-border">
                                        <td className="py-1">{d.label}</td>
                                        <td className="py-1">{d.count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </details>
                </div>
            )}
        </section>
    );
}
