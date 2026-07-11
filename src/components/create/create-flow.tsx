"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import QRCode from "react-qr-code";
import { toast } from "sonner";
import { generatePrompt } from "@/app/actions";
import { MAX_CHARS } from "@/lib/config";
import {
    chooseQrMode,
    countChars,
    toQrByteValue,
    utf8ByteLength,
    EXPIRY_LABELS,
    EXPIRY_PRESETS,
    type ExpiryPreset,
    type QrMode,
} from "@/lib/qr-mode";
import { addClaim } from "@/lib/claims";
import { copyQrImage, downloadQrPng, downloadQrSvg } from "@/lib/qr-export";

type LinkResult = {
    mode: "link";
    slug: string;
    url: string;
    expiresAt: string | null;
    claimToken: string | null;
};
type OfflineResult = { mode: "offline"; text: string };
type Result = LinkResult | OfflineResult;

const chipBase =
    "rounded-full border-[1.5px] px-3.5 py-1.5 text-[13px] font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed";
const chipOff = "border-border bg-card text-muted-foreground hover:border-ring";
const chipOn = "border-ring bg-accent text-foreground";

export function CreateFlow({ isLoggedIn }: { isLoggedIn: boolean }) {
    const [content, setContent] = useState("");
    const [expiresIn, setExpiresIn] = useState<ExpiryPreset>("7d");
    const [oneTime, setOneTime] = useState(false);
    const [modeOverride, setModeOverride] = useState<QrMode | null>(null);
    const [result, setResult] = useState<Result | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const charCount = countChars(content);
    const choice = chooseQrMode(utf8ByteLength(content));
    const mode: QrMode =
        modeOverride && (modeOverride !== "offline" || choice.offlineAvailable)
            ? modeOverride
            : choice.defaultMode;
    const overLimit = charCount > MAX_CHARS;

    const submit = () => {
        setError(null);
        if (content.trim().length === 0) {
            setError("Paste something first — even one character will do ✍️");
            return;
        }
        if (overLimit) {
            setError(
                `That's ${charCount.toLocaleString()} characters — the limit is ${MAX_CHARS.toLocaleString()}.`
            );
            return;
        }

        if (mode === "offline") {
            // Offline QR: the text goes straight into the QR. No network.
            setResult({ mode: "offline", text: content });
            return;
        }

        startTransition(async () => {
            const res = await generatePrompt({ content, isOneTimeView: oneTime, expiresIn });
            if (res.success && res.slug) {
                const url = `${window.location.origin}/${res.slug}`;
                if (res.claimToken) {
                    addClaim({ slug: res.slug, claimToken: res.claimToken });
                }
                setResult({
                    mode: "link",
                    slug: res.slug,
                    url,
                    expiresAt: res.expiresAt ?? null,
                    claimToken: res.claimToken ?? null,
                });
            } else {
                const message =
                    typeof res.error === "string"
                        ? res.error
                        : (res.error?.content?.[0] ??
                          res.error?.expiresIn?.[0] ??
                          "Something went wrong. Please try again.");
                setError(message);
            }
        });
    };

    return (
        <div className="mx-auto w-full max-w-[880px]">
            {/* Textarea card */}
            <div className="relative rounded-3xl border-[1.5px] border-border bg-card focus-within:border-ring">
                <textarea
                    autoFocus
                    value={content}
                    onChange={(e) => {
                        setContent(e.target.value);
                        setError(null);
                    }}
                    placeholder="Paste your prompt, notes, or that 4,000-character system message…"
                    aria-label="Text to share"
                    className="min-h-52 w-full resize-y rounded-3xl bg-transparent p-5 pb-9 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground"
                />
                <span
                    aria-live="polite"
                    className={`pointer-events-none absolute bottom-3 right-4 text-xs ${overLimit ? "font-bold text-destructive" : "text-muted-foreground"}`}
                >
                    {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
                </span>
            </div>

            {/* Options row */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {/* Mode toggle */}
                <div className="flex items-center gap-1 rounded-full border-[1.5px] border-border bg-card p-1">
                    <button
                        type="button"
                        onClick={() => setModeOverride("offline")}
                        disabled={!choice.offlineAvailable}
                        title={choice.offlineUnavailableReason ?? undefined}
                        aria-pressed={mode === "offline"}
                        className={`rounded-full px-3 py-1 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${mode === "offline" ? "bg-accent text-foreground" : "text-muted-foreground"}`}
                    >
                        📴 Offline
                    </button>
                    <button
                        type="button"
                        onClick={() => setModeOverride("link")}
                        aria-pressed={mode === "link"}
                        className={`rounded-full px-3 py-1 text-[13px] font-semibold transition-colors ${mode === "link" ? "bg-accent text-foreground" : "text-muted-foreground"}`}
                    >
                        🔗 Link
                    </button>
                </div>

                {mode === "link" ? (
                    <>
                        {/* Expiration presets */}
                        <div className="flex items-center gap-1 rounded-full border-[1.5px] border-border bg-card p-1">
                            <span aria-hidden="true" className="pl-2 text-[13px]">
                                ⏳
                            </span>
                            {EXPIRY_PRESETS.map((preset) => {
                                const needsLogin = preset === "never" && !isLoggedIn;
                                return (
                                    <button
                                        key={preset}
                                        type="button"
                                        disabled={needsLogin}
                                        onClick={() => setExpiresIn(preset)}
                                        title={needsLogin ? "Sign in to make it permanent" : undefined}
                                        aria-pressed={expiresIn === preset}
                                        className={`rounded-full px-2.5 py-1 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${expiresIn === preset ? "bg-accent text-foreground" : "text-muted-foreground"}`}
                                    >
                                        {EXPIRY_LABELS[preset]}
                                    </button>
                                );
                            })}
                        </div>

                        {/* One-time view */}
                        <button
                            type="button"
                            onClick={() => setOneTime((v) => !v)}
                            aria-pressed={oneTime}
                            className={`${chipBase} ${oneTime ? chipOn : chipOff}`}
                        >
                            👁 one-time
                        </button>
                    </>
                ) : (
                    <span className="px-1 text-[13px] text-muted-foreground">
                        Offline QRs never touch our servers — no expiry needed
                    </span>
                )}
            </div>

            {/* Why-unavailable hint (SPEC §5.1: the toggle must say why) */}
            {choice.offlineUnavailableReason && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                    📴 {choice.offlineUnavailableReason}
                </p>
            )}
            {mode === "link" && expiresIn !== "never" && !isLoggedIn && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                    Guest links last up to 30 days —{" "}
                    <Link href="/login" className="font-semibold text-primary hover:underline">
                        sign in
                    </Link>{" "}
                    to make one permanent
                </p>
            )}

            {error && (
                <p role="alert" className="mt-3 text-center text-sm font-semibold text-destructive">
                    {error}
                </p>
            )}

            {/* Submit */}
            <div className="mt-5 flex justify-center">
                <button
                    type="button"
                    onClick={submit}
                    disabled={pending || overLimit}
                    className="min-h-14 cursor-pointer rounded-2xl bg-primary px-12 font-display text-lg font-semibold text-primary-foreground shadow-[0_6px_18px_color-mix(in_srgb,var(--primary)_35%,transparent)] transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {pending ? "Making…" : result ? "Regenerate ↻" : "Make my QR →"}
                </button>
            </div>

            {result && <ResultPanel result={result} isLoggedIn={isLoggedIn} />}
        </div>
    );
}

function ResultPanel({ result, isLoggedIn }: { result: Result; isLoggedIn: boolean }) {
    const qrWrapRef = useRef<HTMLDivElement>(null);
    const [copiedUrl, setCopiedUrl] = useState(false);

    // Offline text must survive scanning byte-exact — see toQrByteValue.
    const qrValue = result.mode === "offline" ? toQrByteValue(result.text) : result.url;

    const getSvg = () => qrWrapRef.current?.querySelector("svg") ?? null;

    const handle = (fn: (svg: SVGSVGElement) => void | Promise<void>, ok?: string) => async () => {
        const svg = getSvg();
        if (!svg) return;
        try {
            await fn(svg);
            if (ok) toast.success(ok);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "That didn't work — try downloading instead");
        }
    };

    const copyUrl = async () => {
        if (result.mode !== "link") return;
        try {
            await navigator.clipboard.writeText(result.url);
            setCopiedUrl(true);
            setTimeout(() => setCopiedUrl(false), 2000);
        } catch {
            toast.error("Couldn't copy — long-press the URL instead");
        }
    };

    const expiresLabel =
        result.mode === "link"
            ? result.expiresAt
                ? new Date(result.expiresAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                  })
                : "never"
            : null;

    return (
        <section
            aria-label="Your QR code"
            className="mt-8 rounded-3xl border-[1.5px] border-border bg-card p-6"
        >
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                {/* QR: always dark modules on a white card, both themes (SPEC §8) */}
                <div
                    ref={qrWrapRef}
                    className="shrink-0 rounded-2xl border-[1.5px] border-border bg-white p-4"
                >
                    <QRCode
                        value={qrValue}
                        level="M"
                        size={224}
                        fgColor="#241f36"
                        bgColor="#ffffff"
                        style={{ display: "block" }}
                    />
                </div>

                <div className="w-full min-w-0 flex-1">
                    <h2 className="font-display text-xl font-bold">
                        {result.mode === "offline"
                            ? "Ta-da! Your QR is ready ✨"
                            : "Ta-da! Your link is live 🎉"}
                    </h2>

                    <p className="mt-2 inline-block rounded-xl border-[1.5px] border-ring bg-accent px-3 py-1.5 text-[13px] font-semibold">
                        {result.mode === "offline"
                            ? "📴 Offline QR — works without internet, can't expire, fully private."
                            : `🔗 Link QR — trackable, editable, expires ${expiresLabel === "never" ? "never" : `on ${expiresLabel}`}.`}
                    </p>

                    {result.mode === "link" && (
                        <div className="mt-4 flex items-center gap-2 rounded-xl bg-muted p-2 pl-4">
                            <span className="min-w-0 flex-1 truncate font-mono text-sm font-semibold">
                                {result.url.replace(/^https?:\/\//, "")}
                            </span>
                            <button
                                type="button"
                                onClick={copyUrl}
                                aria-live="polite"
                                className="shrink-0 cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.97]"
                            >
                                {copiedUrl ? "Copied ✓" : "Copy"}
                            </button>
                        </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={handle((svg) => downloadQrPng(svg), "PNG downloaded")}
                            className={`${chipBase} ${chipOff}`}
                        >
                            PNG
                        </button>
                        <button
                            type="button"
                            onClick={handle((svg) => downloadQrSvg(svg), "SVG downloaded")}
                            className={`${chipBase} ${chipOff}`}
                        >
                            SVG
                        </button>
                        <button
                            type="button"
                            onClick={handle((svg) => copyQrImage(svg), "QR image copied")}
                            className={`${chipBase} ${chipOff}`}
                        >
                            Copy image
                        </button>
                        {result.mode === "link" && (
                            <a
                                href={`/${result.slug}`}
                                target="_blank"
                                rel="noopener"
                                className={`${chipBase} ${chipOff} inline-block`}
                            >
                                See what they&apos;ll scan →
                            </a>
                        )}
                    </div>

                    {result.mode === "link" && !isLoggedIn && (
                        <p className="mt-4 text-[13px] text-muted-foreground">
                            💾{" "}
                            <Link href="/login" className="font-semibold text-primary hover:underline">
                                Sign in
                            </Link>{" "}
                            to keep, edit, and track this QR.
                        </p>
                    )}
                    {result.mode === "offline" && (
                        <p className="mt-4 text-[13px] text-muted-foreground">
                            The text lives inside the QR itself — nothing was uploaded.
                        </p>
                    )}
                </div>
            </div>
        </section>
    );
}
