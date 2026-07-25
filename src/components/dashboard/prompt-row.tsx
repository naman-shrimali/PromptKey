"use client";

import { useRef, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import QRCode from "react-qr-code";
import { toast } from "sonner";
import { getPromptContent, softDeletePrompt, toggleFavorite } from "@/app/actions/prompts";
import { downloadQrPng } from "@/lib/qr-export";

export type PromptRowData = {
    id: string;
    slug: string;
    title: string;
    charCount: number;
    scanCount: number;
    createdAt: string;
    isFavorite: boolean;
    isOneTimeView: boolean;
    editedCount: number;
    expired: boolean;
    tags: string[];
};

const actionBtn =
    "cursor-pointer rounded-full border-[1.5px] border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:border-ring hover:text-foreground";

const emptySubscribe = () => () => {};

export function PromptRow({ row }: { row: PromptRowData }) {
    const [favorite, setFavorite] = useState(row.isFavorite);
    const [deleting, startDelete] = useTransition();
    const qrRef = useRef<HTMLDivElement>(null);
    // "" during SSR, real origin after hydration (before any user action)
    const origin = useSyncExternalStore(
        emptySubscribe,
        () => window.location.origin,
        () => ""
    );

    const url = () => `${origin}/${row.slug}`;

    const copyText = async () => {
        const res = await getPromptContent(row.id);
        if (res.content === undefined) {
            toast.error(res.error ?? "Couldn't load the text");
            return;
        }
        try {
            await navigator.clipboard.writeText(res.content);
            toast.success("Text copied");
        } catch {
            toast.error("Clipboard unavailable");
        }
    };

    const copyUrl = async () => {
        try {
            await navigator.clipboard.writeText(url());
            toast.success("URL copied");
        } catch {
            toast.error("Clipboard unavailable");
        }
    };

    const downloadQr = async () => {
        const svg = qrRef.current?.querySelector("svg");
        if (!svg) return;
        try {
            await downloadQrPng(svg, `promptkey-${row.slug}.png`);
            toast.success("QR downloaded");
        } catch {
            toast.error("Download failed");
        }
    };

    const onToggleFavorite = async () => {
        setFavorite((f) => !f); // optimistic
        const res = await toggleFavorite(row.id);
        if (res.error) {
            setFavorite((f) => !f);
            toast.error(res.error);
        }
    };

    const onDelete = () => {
        if (!window.confirm(`Delete "${row.title}"? The QR link will stop working.`)) return;
        startDelete(async () => {
            const res = await softDeletePrompt(row.id);
            if (res.error) toast.error(res.error);
            else toast.success("Deleted");
        });
    };

    return (
        <div
            className={`rounded-2xl border-[1.5px] border-border bg-card p-4 ${deleting ? "opacity-50" : ""}`}
        >
            {/* hidden QR used by the download action */}
            <div ref={qrRef} className="hidden" aria-hidden="true">
                {origin && (
                    <QRCode value={url()} level="M" size={128} fgColor="#241f36" bgColor="#ffffff" />
                )}
            </div>

            <div className="flex items-start gap-3">
                <button
                    type="button"
                    onClick={onToggleFavorite}
                    aria-pressed={favorite}
                    aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
                    className={`mt-0.5 cursor-pointer text-lg leading-none transition-transform hover:scale-110 ${favorite ? "" : "opacity-30 grayscale"}`}
                >
                    ⭐
                </button>

                <div className="min-w-0 flex-1">
                    <Link href={`/dashboard/${row.id}`} className="block">
                        <p className="truncate font-semibold hover:text-primary">{row.title}</p>
                    </Link>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <span className="font-mono">/{row.slug}</span>
                        <span>· {row.charCount.toLocaleString()} chars</span>
                        <span>· {row.scanCount} scans</span>
                        <span>· {row.createdAt}</span>
                        {row.editedCount > 0 && (
                            <span className="font-semibold text-primary">
                                · edited {row.editedCount}× · QR unchanged
                            </span>
                        )}
                        {row.isOneTimeView && <span>· 👁 one-time</span>}
                        {row.expired && <span className="text-destructive">· expired</span>}
                    </p>
                    {row.tags.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                            {row.tags.map((tag) => (
                                <span
                                    key={tag}
                                    className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
                                >
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5 pl-8">
                <button type="button" onClick={copyText} className={actionBtn}>
                    Copy text
                </button>
                <button type="button" onClick={copyUrl} className={actionBtn}>
                    Copy URL
                </button>
                <button type="button" onClick={downloadQr} className={actionBtn}>
                    QR ↓
                </button>
                <Link href={`/dashboard/${row.id}`} className={actionBtn}>
                    Edit
                </Link>
                <button
                    type="button"
                    onClick={onDelete}
                    disabled={deleting}
                    className={`${actionBtn} hover:border-destructive hover:text-destructive`}
                >
                    Delete
                </button>
            </div>
        </div>
    );
}
