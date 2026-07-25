"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
    deleteAccount,
    generateApiToken,
    revokeApiToken,
    updateProfile,
} from "@/app/actions/account";
import { handleSignOut } from "@/app/actions/auth";

type Props = {
    user: { name: string; email: string; image: string | null };
    hasApiToken: boolean;
};

const emptySubscribe = () => () => {};

const card = "rounded-3xl border-[1.5px] border-border bg-card p-5";
const sectionTitle = "font-display text-sm font-bold";
const btn =
    "cursor-pointer rounded-2xl border-[1.5px] border-border bg-card px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:border-ring hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50";

export function SettingsPanel({ user, hasApiToken }: Props) {
    const { theme, setTheme } = useTheme();
    const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
    const [name, setName] = useState(user.name);
    const [freshToken, setFreshToken] = useState<string | null>(null);
    const [tokenExists, setTokenExists] = useState(hasApiToken);
    const [pending, startTransition] = useTransition();

    const saveName = () => {
        startTransition(async () => {
            const res = await updateProfile({ name });
            if (res.error) toast.error(res.error);
            else toast.success("Profile saved");
        });
    };

    const onGenerateToken = () => {
        startTransition(async () => {
            const res = await generateApiToken();
            if (res.error || !res.token) {
                toast.error(res.error ?? "Failed to generate token");
                return;
            }
            setFreshToken(res.token);
            setTokenExists(true);
        });
    };

    const onRevokeToken = () => {
        if (!window.confirm("Revoke the API token? The extension will lose access.")) return;
        startTransition(async () => {
            const res = await revokeApiToken();
            if (res.error) toast.error(res.error);
            else {
                setFreshToken(null);
                setTokenExists(false);
                toast.success("Token revoked");
            }
        });
    };

    const onDeleteAccount = () => {
        const phrase = window.prompt(
            'This deletes your account and all your QR codes. Their links stop working immediately. Type "delete" to confirm.'
        );
        if (phrase?.toLowerCase() !== "delete") return;
        startTransition(async () => {
            await deleteAccount(); // redirects on success
        });
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Profile */}
            <section className={card}>
                <h2 className={sectionTitle}>Profile</h2>
                <div className="mt-3 flex items-center gap-3">
                    {user.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={user.image} alt="" className="size-11 rounded-full" />
                    ) : (
                        <span className="flex size-11 items-center justify-center rounded-full bg-accent text-lg">
                            👤
                        </span>
                    )}
                    <div className="min-w-0 flex-1">
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            aria-label="Display name"
                            className="h-11 w-full rounded-2xl border-[1.5px] border-border bg-card px-4 text-sm outline-none focus:border-ring"
                        />
                        <p className="mt-1 truncate pl-1 text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <button
                        type="button"
                        onClick={saveName}
                        disabled={pending || name.trim() === user.name}
                        className={btn}
                    >
                        Save
                    </button>
                </div>
            </section>

            {/* Appearance */}
            <section className={card}>
                <h2 className={sectionTitle}>Appearance</h2>
                <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm">Dark mode</span>
                    {mounted && (
                        <button
                            type="button"
                            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                            className={btn}
                        >
                            {theme === "dark" ? "☀️ Switch to light" : "🌙 Switch to dark"}
                        </button>
                    )}
                </div>
            </section>

            {/* API token */}
            <section className={card}>
                <h2 className={sectionTitle}>API token</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                    Used by the browser extension. We only store a hash — the token is shown once.
                </p>
                {freshToken && (
                    <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted p-2 pl-3">
                        <code className="min-w-0 flex-1 truncate font-mono text-xs font-semibold">
                            {freshToken}
                        </code>
                        <button
                            type="button"
                            className={btn}
                            onClick={async () => {
                                try {
                                    await navigator.clipboard.writeText(freshToken);
                                    toast.success("Token copied — store it safely");
                                } catch {
                                    toast.error("Copy failed — select it manually");
                                }
                            }}
                        >
                            Copy
                        </button>
                    </div>
                )}
                <div className="mt-3 flex gap-2">
                    <button type="button" onClick={onGenerateToken} disabled={pending} className={btn}>
                        {tokenExists ? "Regenerate" : "Generate token"}
                    </button>
                    {tokenExists && (
                        <button
                            type="button"
                            onClick={onRevokeToken}
                            disabled={pending}
                            className={`${btn} hover:border-destructive hover:text-destructive`}
                        >
                            Revoke
                        </button>
                    )}
                </div>
            </section>

            {/* Billing */}
            <section className={card}>
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className={sectionTitle}>Billing</h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Subscription, purchases, and receipts.
                        </p>
                    </div>
                    <Link href="/settings/billing" className={btn}>
                        Open →
                    </Link>
                </div>
            </section>

            {/* Sign out + danger zone */}
            <section className={card}>
                <div className="flex flex-col gap-2">
                    <button type="button" onClick={() => handleSignOut()} className={btn}>
                        Log out
                    </button>
                    <button
                        type="button"
                        onClick={onDeleteAccount}
                        disabled={pending}
                        className={`${btn} border-destructive/40 text-destructive hover:border-destructive hover:text-destructive`}
                    >
                        Delete account &amp; all QR codes
                    </button>
                </div>
            </section>
        </div>
    );
}
