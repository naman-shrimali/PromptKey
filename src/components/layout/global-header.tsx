import Link from "next/link";
import { auth } from "@/auth";
import { HeaderActions } from "@/components/layout/header-actions";

export async function GlobalHeader() {
    const session = await auth();

    return (
        <header className="mx-auto flex w-full max-w-[1060px] items-center gap-2.5 px-5 pb-2 pt-5">
            <Link href="/" className="flex items-center gap-2.5">
                <span
                    aria-hidden="true"
                    className="flex size-9 items-center justify-center rounded-xl bg-primary text-lg shadow-[0_4px_14px_color-mix(in_srgb,var(--primary)_35%,transparent)]"
                >
                    🔑
                </span>
                <span className="font-display text-xl font-bold tracking-[0.2px]">PromptKey</span>
            </Link>

            <nav className="ml-4 hidden gap-1 sm:flex">
                <Link
                    href="/"
                    className="rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                    Make
                </Link>
                <Link
                    href="/dashboard"
                    className="rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                    Library
                </Link>
                <Link
                    href="/market"
                    className="rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                    Market
                </Link>
            </nav>

            <div className="flex-1" />

            <HeaderActions isLoggedIn={!!session} />
        </header>
    );
}
