"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export function LoginForm({ linkSent }: { linkSent: boolean }) {
    const [email, setEmail] = useState("");
    const [pending, setPending] = useState(false);

    const sendMagicLink = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || pending) return;
        setPending(true);
        // Redirects to /login?sent=1 (verifyRequest page) on success.
        await signIn("resend", { email: email.trim(), callbackUrl: "/dashboard" });
    };

    if (linkSent) {
        return (
            <div className="rounded-2xl border-[1.5px] border-ring bg-accent px-6 py-8 text-center">
                <p aria-hidden="true" className="text-4xl">
                    ✉️
                </p>
                <h2 className="mt-3 font-display text-lg font-bold">Check your inbox</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    We sent you a magic sign-in link. It expires in 24 hours.
                </p>
            </div>
        );
    }

    return (
        <>
            <form onSubmit={sendMagicLink} className="flex flex-col gap-3">
                <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold">Email</span>
                    <input
                        type="email"
                        required
                        autoFocus
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="h-13 w-full rounded-2xl border-[1.5px] border-border bg-card px-4 text-[15px] outline-none placeholder:text-muted-foreground focus:border-ring"
                    />
                </label>
                <button
                    type="submit"
                    disabled={pending}
                    className="min-h-13 w-full cursor-pointer rounded-2xl bg-primary font-display text-base font-semibold text-primary-foreground shadow-[0_6px_18px_color-mix(in_srgb,var(--primary)_35%,transparent)] transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {pending ? "Sending…" : "Email me a magic link ✉️"}
                </button>
            </form>

            <div className="flex items-center gap-3 py-5">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs font-semibold text-muted-foreground">OR</span>
                <span className="h-px flex-1 bg-border" />
            </div>

            <button
                type="button"
                onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                className="flex min-h-13 w-full cursor-pointer items-center justify-center gap-3 rounded-2xl border-[1.5px] border-border bg-card text-base font-semibold transition-colors hover:border-ring"
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z" fill="#4285F4"></path>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" fill="#34A853"></path>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84Z" fill="#FBBC05"></path>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" fill="#EA4335"></path>
                </svg>
                Continue with Google
            </button>
        </>
    );
}
