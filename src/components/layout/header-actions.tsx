"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";

const emptySubscribe = () => () => {};

export function HeaderActions({ isLoggedIn }: { isLoggedIn: boolean }) {
    const { resolvedTheme, setTheme } = useTheme();
    // true after hydration only — avoids a server/client theme-icon mismatch
    const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

    return (
        <div className="flex items-center gap-2.5">
            <button
                type="button"
                title="Toggle dark mode"
                aria-label="Toggle dark mode"
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                className="flex size-9 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-border bg-card text-base transition-transform hover:scale-105"
            >
                {mounted ? (resolvedTheme === "dark" ? "☀️" : "🌙") : "🌙"}
            </button>

            {isLoggedIn ? (
                <Link
                    href="/settings"
                    className="rounded-full bg-muted px-4.5 py-2 text-sm font-semibold transition-colors hover:bg-accent"
                >
                    Settings
                </Link>
            ) : (
                <Link
                    href="/login"
                    className="rounded-full bg-muted px-4.5 py-2 text-sm font-semibold transition-colors hover:bg-accent"
                >
                    Log in
                </Link>
            )}
        </div>
    );
}
