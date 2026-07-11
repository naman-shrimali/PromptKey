import { Baloo_2, Nunito_Sans, Geist_Mono } from "next/font/google";

// Shared between both root layouts — (app) and (scan) — so the font
// pipeline instantiates each face exactly once.
export const baloo = Baloo_2({
    variable: "--font-baloo",
    subsets: ["latin"],
    weight: ["500", "600", "700"],
});

export const nunitoSans = Nunito_Sans({
    variable: "--font-nunito-sans",
    subsets: ["latin"],
});

export const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const fontVariables = `${baloo.variable} ${nunitoSans.variable} ${geistMono.variable}`;
