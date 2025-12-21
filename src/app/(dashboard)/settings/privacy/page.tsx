import Link from "next/link";

export default function PrivacyPolicyPage() {
    return (
        <div className="relative mx-auto flex h-auto min-h-screen w-full max-w-md flex-col overflow-x-hidden bg-background-light dark:bg-background-dark">
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-background-light/80 px-4 pb-3 pt-4 backdrop-blur-sm dark:bg-background-dark/80">
                <div className="flex size-12 shrink-0 items-center">
                    <Link href="/settings" className="flex items-center justify-center text-zinc-900 dark:text-white">
                        <span className="material-symbols-outlined text-2xl">arrow_back_ios_new</span>
                    </Link>
                </div>
                <h1 className="text-lg font-bold leading-tight tracking-[-0.015em] text-zinc-900 dark:text-white">
                    Privacy Policy
                </h1>
                <div className="size-12" />
            </header>
            <main className="flex-1 px-4 pt-6">
                <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="mb-4 rounded-full bg-primary/20 p-4 text-primary">
                        <span className="material-symbols-outlined text-4xl">security</span>
                    </div>
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Privacy Policy</h2>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                        This is a static placeholder for the Privacy Policy screen.
                    </p>
                </div>
            </main>
        </div>
    );
}
