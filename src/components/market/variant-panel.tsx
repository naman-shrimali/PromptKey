"use client";

import { useState, useTransition } from "react";
import QRCode from "react-qr-code";
import { toast } from "sonner";
import { sendVariantToPhone, saveVariantToLibrary } from "@/app/actions/market";

type Variant = { model: string; modelLabel: string; content: string };

const pill =
    "cursor-pointer rounded-full border-[1.5px] border-border bg-card px-3.5 py-1.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:border-ring hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50";

// The unlocked view (SPEC §5 M5): tabbed variant switcher, copy per
// variant, "Send to phone" QR (the synergy moment), save to library.
export function VariantPanel({ slug, variants }: { slug: string; variants: Variant[] }) {
    const [active, setActive] = useState(0);
    const [phoneQr, setPhoneQr] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    const variant = variants[active];

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(variant.content);
            toast.success(`${variant.modelLabel} prompt copied`);
        } catch {
            toast.error("Clipboard unavailable");
        }
    };

    const sendToPhone = () => {
        startTransition(async () => {
            const res = await sendVariantToPhone(slug, variant.model);
            if (res.error || !res.slug) {
                toast.error(res.error ?? "Couldn't create the QR");
                return;
            }
            setPhoneQr(`${window.location.origin}/${res.slug}`);
        });
    };

    const saveToLibrary = () => {
        startTransition(async () => {
            const res = await saveVariantToLibrary(slug, variant.model);
            if (res.error || !res.slug) {
                toast.error(res.error ?? "Couldn't save");
                return;
            }
            toast.success("Saved to your library 💾");
        });
    };

    return (
        <div className="mt-5 rounded-3xl border-[1.5px] border-border bg-card p-5">
            {/* Variant tabs */}
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Model variants">
                {variants.map((v, i) => (
                    <button
                        key={v.model}
                        type="button"
                        role="tab"
                        aria-selected={i === active}
                        onClick={() => {
                            setActive(i);
                            setPhoneQr(null);
                        }}
                        className={`rounded-full border-[1.5px] px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                            i === active
                                ? "border-ring bg-accent text-foreground"
                                : "border-border bg-card text-muted-foreground hover:border-ring"
                        }`}
                    >
                        {v.modelLabel}
                    </button>
                ))}
            </div>

            <pre className="mt-4 max-h-[50vh] overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-muted p-4 font-mono text-[13px] leading-relaxed">
                {variant.content}
            </pre>

            <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={copy} className={pill}>
                    Copy 📋
                </button>
                <button type="button" onClick={sendToPhone} disabled={pending} className={pill}>
                    Send to phone 📱
                </button>
                <button type="button" onClick={saveToLibrary} disabled={pending} className={pill}>
                    Save to my library 💾
                </button>
            </div>

            {phoneQr && (
                <div className="mt-4 flex items-center gap-4 rounded-2xl border-[1.5px] border-ring bg-accent p-4">
                    {/* Always dark modules on white (SPEC §8) */}
                    <div className="shrink-0 rounded-xl bg-white p-2.5">
                        <QRCode value={phoneQr} level="M" size={128} fgColor="#241f36" bgColor="#ffffff" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold">Scan with your phone camera 📱</p>
                        <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                            {phoneQr.replace(/^https?:\/\//, "")}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            This link is yours and expires in 24 hours.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
