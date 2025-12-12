"use client";

import { signIn } from "next-auth/react";

export function LoginForm() {
    return (
        <>
            {/* Social Login */}
            <div className="flex flex-col gap-4">
                <button
                    onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                    className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-5 w-full bg-slate-200 dark:bg-[#233c48] text-slate-800 dark:text-white gap-3 text-base font-bold leading-normal tracking-[0.015em] transition-colors hover:bg-slate-300 dark:hover:bg-[#2a4655]"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className="h-6 w-6" data-alt="Google G logo in multiple colors">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z" fill="#4285F4"></path>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" fill="#34A853"></path>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84Z" fill="#FBBC05"></path>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" fill="#EA4335"></path>
                    </svg>
                    <span className="truncate">Continue with Google</span>
                </button>
            </div>

            {/* Divider */}
            <p className="text-slate-500 dark:text-[#92b7c9] text-sm font-normal leading-normal py-6 text-center">OR</p>

            {/* Email/Phone Form (Visual Only as per current auth config) */}
            <div className="flex w-full flex-col gap-4">
                <label className="flex flex-col w-full">
                    <p className="text-slate-900 dark:text-white text-base font-medium leading-normal pb-2">Email or phone number</p>
                    <input
                        className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-slate-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary border-slate-300 dark:border-[#325567] bg-white dark:bg-[#192b33] focus:border-primary dark:focus:border-primary h-14 placeholder:text-slate-400 dark:placeholder:text-[#92b7c9] p-4 text-base font-normal leading-normal"
                        placeholder="Enter your email or phone number"
                        disabled // Disabled as we only have Google Auth implemented
                    />
                </label>
                <button
                    disabled
                    className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-5 w-full bg-primary text-white text-base font-bold leading-normal tracking-[0.015em] transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <span className="truncate">Continue</span>
                </button>
            </div>
        </>
    );
}
