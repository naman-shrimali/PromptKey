import { auth } from "@/auth";
import { Prompt } from "@/lib/models";
import dbConnect from "@/lib/db";
import Link from "next/link";

async function getPrompts(userId: string) {
    await dbConnect();
    // Fetch prompts for the user, sorted by creation date desc
    const prompts = await Prompt.find({ ownerUserId: userId }).sort({ createdAt: -1 });
    return prompts;
}

export default async function DashboardPage() {
    const session = await auth();
    const prompts = await getPrompts(session?.user?.id as string);

    return (
        <div className="relative mx-auto flex h-auto min-h-screen w-full max-w-md flex-col overflow-x-hidden">
            {/* Top App Bar */}
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-background-light/80 px-4 pb-3 pt-4 backdrop-blur-sm dark:bg-background-dark/80">
                <div className="flex size-12 shrink-0 items-center">
                    {/* Placeholder for potential back button or logo */}
                </div>
                <h1 className="text-lg font-bold leading-tight tracking-[-0.015em] text-zinc-900 dark:text-white">Dashboard</h1>
                <div className="flex items-center justify-end gap-3">
                    <Link href="/">
                        <button className="flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-primary text-white">
                            <span className="material-symbols-outlined text-2xl">add</span>
                        </button>
                    </Link>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 px-4 pt-4">
                {/* Search Bar */}
                <div className="mb-6">
                    <label className="flex w-full flex-col">
                        <div className="flex h-12 w-full flex-1 items-stretch rounded-xl">
                            <div className="flex items-center justify-center rounded-l-xl border border-r-0 border-white/10 bg-white/5 pl-4 text-zinc-500 dark:text-zinc-400">
                                <span className="material-symbols-outlined text-2xl">search</span>
                            </div>
                            <input className="form-input h-full min-w-0 flex-1 resize-none overflow-hidden rounded-r-xl border border-l-0 border-white/10 bg-white/5 px-4 text-base font-normal leading-normal text-zinc-900 placeholder:text-zinc-500 focus:outline-0 focus:ring-2 focus:ring-primary/50 dark:text-white dark:placeholder:text-zinc-400" placeholder="Search by text content..." />
                        </div>
                    </label>
                </div>

                {/* QR Code List */}
                <div className="flex flex-col gap-4">
                    {prompts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/5 py-16 text-center">
                            <div className="mb-4 rounded-full bg-primary/20 p-4 text-primary">
                                <span className="material-symbols-outlined text-4xl">qr_code_2</span>
                            </div>
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">No QR Codes Yet</h2>
                            <p className="mt-1 max-w-xs text-sm text-zinc-600 dark:text-zinc-400">Tap the &apos;+&apos; button to generate your first QR code.</p>
                            <Link href="/">
                                <button className="mt-6 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white">Create New QR Code</button>
                            </Link>
                        </div>
                    ) : (
                        prompts.map((prompt) => (
                            <div key={prompt._id.toString()} className="flex flex-col gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex flex-1 items-start gap-4">
                                        {/* Placeholder Image - In real app, we'd generate the QR image here or store it */}
                                        <div className="aspect-square w-[70px] shrink-0 rounded-lg bg-white flex items-center justify-center">
                                            <span className="material-symbols-outlined text-3xl text-black">qr_code</span>
                                        </div>
                                        <div className="flex flex-1 flex-col justify-center">
                                            <p className="text-base font-medium leading-normal text-zinc-900 dark:text-white">Prompt</p>
                                            <p className="text-sm font-normal leading-normal text-zinc-600 dark:text-zinc-400">Created on {new Date(prompt.createdAt).toLocaleDateString()}</p>
                                            <p className="mt-1 line-clamp-2 text-sm font-normal leading-normal text-zinc-600 dark:text-zinc-400">
                                                {/* We don't show decrypted content here for security, just metadata or placeholder */}
                                                Encrypted Content
                                            </p>
                                        </div>
                                    </div>
                                    <div className="shrink-0">
                                        <button className="flex size-7 items-center justify-center text-zinc-600 dark:text-zinc-400">
                                            <span className="material-symbols-outlined text-2xl">more_vert</span>
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="flex flex-col items-center gap-2 rounded-lg py-2.5 text-center transition-colors hover:bg-white/5">
                                        <div className="rounded-full bg-primary/20 p-2.5">
                                            <span className="material-symbols-outlined text-xl text-primary">description</span>
                                        </div>
                                        <p className="text-xs font-medium leading-normal text-zinc-700 dark:text-zinc-300">Copy Text</p>
                                    </div>
                                    <div className="flex flex-col items-center gap-2 rounded-lg py-2.5 text-center transition-colors hover:bg-white/5">
                                        <div className="rounded-full bg-primary/20 p-2.5">
                                            <span className="material-symbols-outlined text-xl text-primary">link</span>
                                        </div>
                                        <p className="text-xs font-medium leading-normal text-zinc-700 dark:text-zinc-300">Copy URL</p>
                                    </div>
                                    <Link href={`/dashboard/${prompt._id.toString()}`} className="flex flex-col items-center gap-2 rounded-lg py-2.5 text-center transition-colors hover:bg-white/5 cursor-pointer">
                                        <div className="rounded-full bg-primary/20 p-2.5">
                                            <span className="material-symbols-outlined text-xl text-primary">bar_chart</span>
                                        </div>
                                        <p className="text-xs font-medium leading-normal text-zinc-700 dark:text-zinc-300">Analytics</p>
                                    </Link>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </main>
            {/* Padding at the bottom for scroll clearance */}
            <div className="h-10"></div>
        </div>
    );
}
