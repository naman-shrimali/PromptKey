"use client";

import { useRef, useState, useSyncExternalStore, useTransition } from "react";
import QRCode from "react-qr-code";
import { toast } from "sonner";
import { restoreVersion, updatePrompt } from "@/app/actions/prompts";
import { downloadQrPng, downloadQrSvg } from "@/lib/qr-export";
import { countChars, EXPIRY_LABELS, EXPIRY_PRESETS, type ExpiryPreset } from "@/lib/qr-mode";
import { MAX_CHARS } from "@/lib/config";

type EditorPrompt = {
    id: string;
    slug: string;
    content: string;
    e2e: boolean;
    tags: string[];
    scanCount: number;
    isOneTimeView: boolean;
    expiresAt: string | null;
    editedCount: number;
    createdAt: string;
    versions: Array<{ index: number; editedAt: string }>;
};

const pill =
    "cursor-pointer rounded-full border-[1.5px] border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-ring hover:text-foreground";

const emptySubscribe = () => () => {};

export function PromptEditor({ prompt }: { prompt: EditorPrompt }) {
    const [content, setContent] = useState(prompt.content);
    const [tagsInput, setTagsInput] = useState(prompt.tags.join(", "));
    const [expiresIn, setExpiresIn] = useState<ExpiryPreset | "">("");
    const [pending, startTransition] = useTransition();
    const qrRef = useRef<HTMLDivElement>(null);

    const origin = useSyncExternalStore(
        emptySubscribe,
        () => window.location.origin,
        () => ""
    );
    const url = `${origin}/${prompt.slug}`;

    const charCount = countChars(content);
    const dirty =
        content !== prompt.content ||
        tagsInput.trim() !== prompt.tags.join(", ").trim() ||
        expiresIn !== "";

    const save = () => {
        if (!prompt.e2e && content.trim().length === 0) {
            toast.error("Content can't be empty");
            return;
        }
        if (charCount > MAX_CHARS) {
            toast.error(`Too long — max ${MAX_CHARS.toLocaleString()} characters`);
            return;
        }
        startTransition(async () => {
            const res = await updatePrompt({
                id: prompt.id,
                content: !prompt.e2e && content !== prompt.content ? content : undefined,
                tags: tagsInput
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                ...(expiresIn ? { expiresIn } : {}),
            });
            if (res.error) toast.error(res.error);
            else {
                toast.success(
                    res.edited ? "Saved — same QR, new content ✨" : "Saved"
                );
                setExpiresIn("");
            }
        });
    };

    const onRestore = (index: number, label: string) => {
        if (!window.confirm(`Restore the version from ${label}? Current content is kept in history.`))
            return;
        startTransition(async () => {
            const res = await restoreVersion(prompt.id, index);
            if (res.error) toast.error(res.error);
            else {
                toast.success("Version restored — QR unchanged");
                window.location.reload();
            }
        });
    };

    const exportQr = async (kind: "png" | "svg") => {
        const svg = qrRef.current?.querySelector("svg");
        if (!svg) return;
        try {
            if (kind === "png") await downloadQrPng(svg, `promptkey-${prompt.slug}.png`);
            else downloadQrSvg(svg, `promptkey-${prompt.slug}.svg`);
        } catch {
            toast.error("Export failed");
        }
    };

    return (
        <div className="mt-4 flex flex-col gap-5 md:flex-row md:items-start">
            {/* Left: QR + stats. The whole point: this QR never changes. */}
            <div className="w-full shrink-0 md:w-64">
                <div className="rounded-3xl border-[1.5px] border-border bg-card p-5">
                    <div ref={qrRef} className="rounded-2xl bg-white p-3">
                        {origin && (
                            <QRCode
                                value={url}
                                level="M"
                                size={200}
                                fgColor="#241f36"
                                bgColor="#ffffff"
                                style={{ display: "block", width: "100%", height: "auto" }}
                            />
                        )}
                    </div>
                    <p className="mt-3 break-all text-center font-mono text-xs font-semibold text-muted-foreground">
                        /{prompt.slug}
                    </p>
                    <div className="mt-3 flex justify-center gap-1.5">
                        <button type="button" onClick={() => exportQr("png")} className={pill}>
                            PNG
                        </button>
                        <button type="button" onClick={() => exportQr("svg")} className={pill}>
                            SVG
                        </button>
                        <a href={url} target="_blank" rel="noopener" className={pill}>
                            View ↗
                        </a>
                        {!prompt.e2e && (
                            <a href={`${url}/present`} target="_blank" rel="noopener" className={pill}>
                                Present ▶
                            </a>
                        )}
                    </div>
                </div>

                <div className="mt-3 rounded-2xl border-[1.5px] border-border bg-card px-4 py-3 text-xs text-muted-foreground">
                    <p>
                        <b className="text-foreground">{prompt.scanCount}</b> scans · created{" "}
                        {prompt.createdAt}
                    </p>
                    {prompt.editedCount > 0 && (
                        <p className="mt-1 font-semibold text-primary">
                            edited {prompt.editedCount}× · QR unchanged
                        </p>
                    )}
                    {prompt.isOneTimeView && <p className="mt-1">👁 one-time view</p>}
                    {prompt.expiresAt && (
                        <p className="mt-1">
                            expires{" "}
                            {new Date(prompt.expiresAt).toLocaleDateString("en", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                            })}
                        </p>
                    )}
                </div>
            </div>

            {/* Right: editor */}
            <div className="min-w-0 flex-1">
                {prompt.e2e && (
                    <p className="mb-3 rounded-2xl border-[1.5px] border-ring bg-accent px-4 py-3 text-[13px] font-semibold">
                        🔒 End-to-end encrypted — we never see this text, so it can&apos;t be
                        viewed or edited here. Tags and expiry still work.
                    </p>
                )}
                <div className="relative rounded-3xl border-[1.5px] border-border bg-card focus-within:border-ring" hidden={prompt.e2e}>
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        aria-label="Prompt content"
                        className="min-h-64 w-full resize-y rounded-3xl bg-transparent p-5 pb-9 font-mono text-[13.5px] leading-relaxed outline-none"
                    />
                    <span className="pointer-events-none absolute bottom-3 right-4 text-xs text-muted-foreground">
                        {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
                    </span>
                </div>

                <label className="mt-3 block">
                    <span className="text-xs font-semibold text-muted-foreground">
                        Tags (comma-separated)
                    </span>
                    <input
                        value={tagsInput}
                        onChange={(e) => setTagsInput(e.target.value)}
                        placeholder="writing, email, work"
                        className="mt-1 h-11 w-full rounded-2xl border-[1.5px] border-border bg-card px-4 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
                    />
                </label>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">⏳ New expiry:</span>
                    {EXPIRY_PRESETS.map((preset) => (
                        <button
                            key={preset}
                            type="button"
                            onClick={() => setExpiresIn((v) => (v === preset ? "" : preset))}
                            aria-pressed={expiresIn === preset}
                            className={`rounded-full border-[1.5px] px-3 py-1 text-xs font-semibold transition-colors ${
                                expiresIn === preset
                                    ? "border-ring bg-accent text-foreground"
                                    : "border-border bg-card text-muted-foreground hover:border-ring"
                            }`}
                        >
                            {EXPIRY_LABELS[preset]}
                        </button>
                    ))}
                </div>

                <button
                    type="button"
                    onClick={save}
                    disabled={pending || !dirty}
                    className="mt-5 min-h-13 w-full cursor-pointer rounded-2xl bg-primary font-display text-base font-semibold text-primary-foreground shadow-[0_6px_18px_color-mix(in_srgb,var(--primary)_35%,transparent)] transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {pending ? "Saving…" : "Save — QR stays the same 🔗"}
                </button>

                {prompt.versions.length > 0 && (
                    <div className="mt-6">
                        <h2 className="font-display text-sm font-bold">Version history</h2>
                        <div className="mt-2 flex flex-col gap-1.5">
                            {[...prompt.versions].reverse().map((v) => (
                                <div
                                    key={v.index}
                                    className="flex items-center justify-between rounded-xl border-[1.5px] border-border bg-card px-4 py-2.5"
                                >
                                    <span className="text-xs text-muted-foreground">{v.editedAt}</span>
                                    <button
                                        type="button"
                                        onClick={() => onRestore(v.index, v.editedAt)}
                                        disabled={pending}
                                        className={pill}
                                    >
                                        Restore
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
