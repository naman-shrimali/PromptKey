"use client";

import Link from "next/link";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "next-themes";
import { handleSignOut } from "@/app/actions/auth";
import { useEffect, useState } from "react";

export default function SettingsPage() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);
    return (
        <div className="relative mx-auto flex h-auto min-h-screen w-full max-w-md flex-col overflow-x-hidden bg-background-light dark:bg-background-dark">
            {/* Top App Bar */}
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-background-light/80 px-4 pb-3 pt-4 backdrop-blur-sm dark:bg-background-dark/80">
                <div className="flex size-12 shrink-0 items-center">
                    <Link href="/dashboard" className="flex items-center justify-center text-zinc-900 dark:text-white">
                        <span className="material-symbols-outlined text-2xl">arrow_back_ios_new</span>
                    </Link>
                </div>
                <h1 className="text-lg font-bold leading-tight tracking-[-0.015em] text-zinc-900 dark:text-white">
                    Settings
                </h1>
                <div className="flex w-12 items-center justify-end">
                    <Link href="/dashboard" className="text-base font-semibold text-primary">
                        Done
                    </Link>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 px-4 pt-6">
                {/* Account Section */}
                <div className="mb-6">
                    <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Account
                    </h2>
                    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                        <Link href="/settings/edit-profile">
                            <div className="flex items-center justify-between border-b border-white/10 p-4 transition-colors hover:bg-white/5 active:bg-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="flex size-8 items-center justify-center rounded-lg bg-[#0ea5e9]/20 text-[#0ea5e9]">
                                        <span className="material-symbols-outlined text-xl">person</span>
                                    </div>
                                    <span className="text-base font-medium text-zinc-900 dark:text-white">
                                        Edit Profile
                                    </span>
                                </div>
                                <span className="material-symbols-outlined text-xl text-zinc-500 dark:text-zinc-600">
                                    chevron_right
                                </span>
                            </div>
                        </Link>
                        <Link href="/settings/change-password">
                            <div className="flex items-center justify-between border-b border-white/10 p-4 transition-colors hover:bg-white/5 active:bg-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="flex size-8 items-center justify-center rounded-lg bg-[#0ea5e9]/20 text-[#0ea5e9]">
                                        <span className="material-symbols-outlined text-xl">lock</span>
                                    </div>
                                    <span className="text-base font-medium text-zinc-900 dark:text-white">
                                        Change Password
                                    </span>
                                </div>
                                <span className="material-symbols-outlined text-xl text-zinc-500 dark:text-zinc-600">
                                    chevron_right
                                </span>
                            </div>
                        </Link>
                        <Link href="/settings/linked-accounts">
                            <div className="flex items-center justify-between p-4 transition-colors hover:bg-white/5 active:bg-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="flex size-8 items-center justify-center rounded-lg bg-[#0ea5e9]/20 text-[#0ea5e9]">
                                        <span className="material-symbols-outlined text-xl">link</span>
                                    </div>
                                    <span className="text-base font-medium text-zinc-900 dark:text-white">
                                        Linked Accounts
                                    </span>
                                </div>
                                <span className="material-symbols-outlined text-xl text-zinc-500 dark:text-zinc-600">
                                    chevron_right
                                </span>
                            </div>
                        </Link>
                    </div>
                </div>

                {/* Preferences Section */}
                <div className="mb-6">
                    <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Preferences
                    </h2>
                    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                        <Link href="/settings/notifications">
                            <div className="flex items-center justify-between border-b border-white/10 p-4 transition-colors hover:bg-white/5 active:bg-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="flex size-8 items-center justify-center rounded-lg bg-[#0ea5e9]/20 text-[#0ea5e9]">
                                        <span className="material-symbols-outlined text-xl">notifications</span>
                                    </div>
                                    <span className="text-base font-medium text-zinc-900 dark:text-white">
                                        Notifications
                                    </span>
                                </div>
                                <span className="material-symbols-outlined text-xl text-zinc-500 dark:text-zinc-600">
                                    chevron_right
                                </span>
                            </div>
                        </Link>
                        <div className="flex items-center justify-between p-4">
                            <div className="flex items-center gap-3">
                                <div className="flex size-8 items-center justify-center rounded-lg bg-[#0ea5e9]/20 text-[#0ea5e9]">
                                    <span className="material-symbols-outlined text-xl">dark_mode</span>
                                </div>
                                <span className="text-base font-medium text-zinc-900 dark:text-white">
                                    Dark Mode
                                </span>
                            </div>
                            {mounted && (
                                <Switch
                                    checked={theme === "dark"}
                                    onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* Support Section */}
                <div className="mb-8">
                    <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Support
                    </h2>
                    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                        <Link href="/settings/help">
                            <div className="flex items-center justify-between border-b border-white/10 p-4 transition-colors hover:bg-white/5 active:bg-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="flex size-8 items-center justify-center rounded-lg bg-[#0ea5e9]/20 text-[#0ea5e9]">
                                        <span className="material-symbols-outlined text-xl">help</span>
                                    </div>
                                    <span className="text-base font-medium text-zinc-900 dark:text-white">
                                        Help Center
                                    </span>
                                </div>
                                <span className="material-symbols-outlined text-xl text-zinc-500 dark:text-zinc-600">
                                    chevron_right
                                </span>
                            </div>
                        </Link>
                        <Link href="/settings/contact">
                            <div className="flex items-center justify-between border-b border-white/10 p-4 transition-colors hover:bg-white/5 active:bg-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="flex size-8 items-center justify-center rounded-lg bg-[#0ea5e9]/20 text-[#0ea5e9]">
                                        <span className="material-symbols-outlined text-xl">support_agent</span>
                                    </div>
                                    <span className="text-base font-medium text-zinc-900 dark:text-white">
                                        Contact Support
                                    </span>
                                </div>
                                <span className="material-symbols-outlined text-xl text-zinc-500 dark:text-zinc-600">
                                    chevron_right
                                </span>
                            </div>
                        </Link>
                        <Link href="/settings/privacy">
                            <div className="flex items-center justify-between p-4 transition-colors hover:bg-white/5 active:bg-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="flex size-8 items-center justify-center rounded-lg bg-[#0ea5e9]/20 text-[#0ea5e9]">
                                        <span className="material-symbols-outlined text-xl">security</span>
                                    </div>
                                    <span className="text-base font-medium text-zinc-900 dark:text-white">
                                        Privacy Policy
                                    </span>
                                </div>
                                <span className="material-symbols-outlined text-xl text-zinc-500 dark:text-zinc-600">
                                    chevron_right
                                </span>
                            </div>
                        </Link>
                    </div>
                </div>

                {/* Log Out Button */}
                <button
                    onClick={() => handleSignOut()}
                    className="mb-10 w-full rounded-xl border border-white/10 bg-white/5 py-4 text-base font-semibold text-red-500 transition-colors hover:bg-red-500/10 active:bg-red-500/20"
                >
                    Log Out
                </button>
            </main>
        </div>
    );
}
