"use client";

import { useFormStatus } from "react-dom";
import { generatePrompt } from "@/app/actions";
import { useActionState, useState, useEffect } from "react";
import { toast } from "sonner";
import { QRGenerator } from "@/components/qr/qr-generator";
import { QRActions } from "@/components/qr/qr-actions";
import { Loader2 } from "lucide-react";

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <button
            disabled={pending}
            className="flex min-w-[84px] w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-5 flex-1 bg-primary text-white text-base font-bold leading-normal tracking-[0.015em] hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {pending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <span className="truncate">Generate QR Code</span>
            )}
        </button>
    );
}

type FormState = {
    error?: {
        content?: string[];
        isOneTimeView?: string[];
    } | string;
    success?: boolean;
    slug?: string;
};

const initialState: FormState = {
    error: undefined,
    success: false,
    slug: undefined,
};

export function PromptInput() {
    const [state, formAction] = useActionState(generatePrompt as any, initialState);
    const [generatedUrl, setGeneratedUrl] = useState<string>("");

    useEffect(() => {
        if (state.success && state.slug) {
            const url = `${window.location.origin}/${state.slug}`;
            setGeneratedUrl(url);
            toast.success("QR Code generated successfully!");
        } else if (state.error) {
            if (typeof state.error === 'string') {
                toast.error(state.error);
            } else {
                // If it's an object, it might be validation errors. 
                // We display them inline, but we can also toast a generic message.
                toast.error("Please check your input.");
            }
        }
    }, [state]);

    if (generatedUrl) {
        // Show QR Code Display Screen (Screen 2)
        return (
            <div className="fixed inset-0 z-50 bg-background-light dark:bg-background-dark flex flex-col">
                {/* Top App Bar */}
                <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between bg-background-light/80 px-4 backdrop-blur-sm dark:bg-background-dark/80">
                    <div className="flex items-center">
                        <button aria-label="Back" onClick={() => setGeneratedUrl("")}>
                            <span className="material-symbols-outlined text-zinc-900 dark:text-white">arrow_back_ios_new</span>
                        </button>
                    </div>
                    <h1 className="text-lg font-bold text-zinc-900 dark:text-white">QR Code</h1>
                    <div className="w-8"></div> {/* Spacer */}
                </header>
                {/* Main Content */}
                <main className="flex flex-1 flex-col px-4 pt-8 pb-4">
                    {/* QR Code Card */}
                    <div className="flex flex-col items-center justify-center rounded-xl bg-white p-6 shadow-sm dark:bg-zinc-800/50">
                        <div id="qr-code-container" className="flex aspect-square w-full max-w-xs items-center justify-center rounded-lg bg-white p-4">
                            <QRGenerator url={generatedUrl} />
                        </div>
                    </div>
                    {/* Short URL Section */}
                    <div className="mt-8 flex items-center justify-between gap-4 rounded-lg bg-white/50 p-4 dark:bg-zinc-800/50">
                        <div className="flex items-center gap-4 overflow-hidden">
                            <div className="flex shrink-0 items-center justify-center rounded-lg bg-primary/20 size-10 text-primary">
                                <span className="material-symbols-outlined text-primary">link</span>
                            </div>
                            <p className="truncate text-base font-normal text-zinc-900 dark:text-white">{generatedUrl}</p>
                        </div>
                        <div className="shrink-0">
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(generatedUrl);
                                    toast.success("Copied to clipboard");
                                }}
                                className="flex h-10 w-fit cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-zinc-200 px-4 text-sm font-medium text-zinc-800 dark:bg-zinc-700 dark:text-white"
                            >
                                <span className="truncate">Copy</span>
                            </button>
                        </div>
                    </div>
                    <div className="flex-grow"></div> {/* Spacer */}
                    {/* Action Buttons */}
                    <div className="mt-8 flex flex-col gap-3 pb-4">
                        <QRActions targetId="qr-code-container" />
                    </div>
                </main>
            </div>
        );
    }

    return (
        <form action={formAction} className="w-full">
            {/* Text Field */}
            <div className="flex w-full flex-wrap items-end gap-4">
                <label className="flex flex-col min-w-40 flex-1">
                    <p className="text-slate-900 dark:text-white text-base font-medium leading-normal pb-2">Your Text or URL</p>
                    <textarea
                        name="content"
                        className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-slate-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/50 focus:border-primary/50 dark:focus:border-primary/50 min-h-36 placeholder:text-slate-400 dark:placeholder:text-slate-500 p-[15px] text-base font-normal leading-normal transition-all"
                        placeholder="Paste your long text or URL here..."
                    ></textarea>
                </label>
            </div>
            {state.error && typeof state.error !== 'string' && state.error.content && (
                <p className="text-sm text-red-500 mt-1">{state.error.content[0]}</p>
            )}

            {/* Single Button CTA */}
            <div className="pt-6">
                <SubmitButton />
            </div>

            {/* Advanced Options Section */}
            <div className="pt-8">
                <details className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between py-2 text-base font-medium text-slate-900 dark:text-white">
                        Advanced Options
                        <span className="transition-transform group-open:rotate-180">
                            <span className="material-symbols-outlined">expand_more</span>
                        </span>
                    </summary>
                    <div className="mt-4 space-y-6">
                        {/* Toggle Switches */}
                        <div className="flex items-center justify-between">
                            <label className="text-slate-700 dark:text-slate-300" htmlFor="one-time-view">One-time view</label>
                            <div className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-slate-200 dark:bg-slate-700 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-background-dark">
                                <input type="checkbox" name="isOneTimeView" id="one-time-view" className="peer sr-only" />
                                <span className="pointer-events-none absolute left-0 inline-block h-5 w-5 translate-x-0 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out peer-checked:translate-x-5 peer-checked:bg-primary"></span>
                            </div>
                        </div>

                        {/* Password Protection (Visual Only for now as per logic) */}
                        <div className="flex items-center justify-between opacity-50 cursor-not-allowed" title="Not implemented yet">
                            <label className="text-slate-700 dark:text-slate-300" htmlFor="password-protection">Password protection</label>
                            <button type="button" aria-checked="false" className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-slate-200 dark:bg-slate-700 transition-colors duration-200 ease-in-out" role="switch">
                                <span className="pointer-events-none inline-block h-5 w-5 translate-x-0 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"></span>
                            </button>
                        </div>

                        {/* Segmented Control (Visual Only) */}
                        <div>
                            <p className="text-slate-700 dark:text-slate-300 pb-3">Link expires in</p>
                            <div className="grid grid-cols-4 gap-2 rounded-lg bg-slate-200 dark:bg-slate-800/50 p-1">
                                <button type="button" className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50 transition-colors">1 Day</button>
                                <button type="button" className="rounded-md bg-white dark:bg-slate-900/70 px-3 py-2 text-sm font-bold text-primary shadow-sm transition-colors">7 Days</button>
                                <button type="button" className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50 transition-colors">30 Days</button>
                                <button type="button" className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50 transition-colors">Never</button>
                            </div>
                        </div>
                    </div>
                </details>
            </div>
        </form>
    );
}
