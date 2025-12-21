"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface HeaderActionsProps {
    isLoggedIn: boolean;
}

export function HeaderActions({ isLoggedIn }: HeaderActionsProps) {
    const pathname = usePathname();

    if (!isLoggedIn) {
        return (
            <Link href="/login">
                <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90">
                    Login
                </button>
            </Link>
        );
    }

    // If logged in and on settings page, show nothing (or we could show "Done" here if desired)
    if (pathname === "/settings") {
        return null;
    }

    return (
        <Link href="/settings">
            <button className="flex size-10 items-center justify-center rounded-full text-zinc-900 transition-colors hover:bg-white/10 dark:text-white">
                <span className="material-symbols-outlined text-2xl">settings</span>
            </button>
        </Link>
    );
}
