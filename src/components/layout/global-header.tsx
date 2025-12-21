import Link from "next/link";
import { auth } from "@/auth";
import { HeaderActions } from "@/components/layout/header-actions";

export async function GlobalHeader() {
    const session = await auth();

    return (
        <header className="sticky top-0 z-50 flex h-14 w-full items-center justify-between border-b border-white/10 bg-background-light/80 px-4 backdrop-blur-sm dark:bg-background-dark/80">
            <div className="flex items-center">
                <Link href={session ? "/dashboard" : "/"} className="text-lg font-bold tracking-[-0.015em] text-zinc-900 dark:text-white">
                    PromptKey
                </Link>
            </div>
            <div className="flex items-center gap-4">
                <HeaderActions isLoggedIn={!!session} />
            </div>
        </header>
    );
}
