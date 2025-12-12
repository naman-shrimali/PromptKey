export default function MarketingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="relative flex min-h-screen w-full flex-col">
            {/* Top App Bar */}
            <header className="flex items-center bg-background-light dark:bg-background-dark p-4 pb-2 justify-between sticky top-0 z-10">
                <div className="flex size-12 shrink-0 items-center justify-start">
                </div>
                <h1 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">QR Generator</h1>
                <div className="flex w-12 items-center justify-end">
                    <button className="flex max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 bg-transparent text-slate-900 dark:text-white gap-2 text-base font-bold leading-normal tracking-[0.015em] min-w-0 p-0">
                        <span className="material-symbols-outlined">settings</span>
                    </button>
                </div>
            </header>
            <main className="flex-1 px-4 py-6">
                {children}
            </main>
            <footer className="py-6 md:px-8 md:py-0">
                <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
                    <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
                        Built by Antigravity.
                    </p>
                </div>
            </footer>
        </div>
    );
}
