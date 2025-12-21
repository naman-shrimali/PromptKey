export default function MarketingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="relative flex min-h-screen w-full flex-col">
            {/* Top App Bar removed - using GlobalHeader */}
            <main className="flex-1 px-4 py-6">
                {children}
            </main>
        </div>
    );
}
