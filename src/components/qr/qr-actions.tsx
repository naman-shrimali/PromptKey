"use client";

import { Button } from "@/components/ui/button";
import { Download, ImageIcon } from "lucide-react";
import { toPng, toSvg } from "html-to-image";
import { toast } from "sonner";

export function QRActions({ targetId }: { targetId: string }) {
    const handleDownload = async (format: "png" | "svg") => {
        const element = document.getElementById(targetId);
        if (!element) return;

        try {
            let dataUrl;
            if (format === "png") {
                dataUrl = await toPng(element, { cacheBust: true, backgroundColor: 'white' });
            } else {
                dataUrl = await toSvg(element, { cacheBust: true, backgroundColor: 'white' });
            }

            const link = document.createElement("a");
            link.download = `qr-code.${format}`;
            link.href = dataUrl;
            link.click();
            toast.success(`Downloaded ${format.toUpperCase()}`);
        } catch (err) {
            console.error(err);
            toast.error("Failed to download QR code");
        }
    };

    return (
        <>
            <button
                onClick={() => handleDownload("png")}
                className="flex h-12 min-w-[84px] max-w-[480px] flex-1 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl bg-primary px-5 pl-5 text-base font-bold leading-normal tracking-[0.015em] text-white"
            >
                <span className="material-symbols-outlined">download</span>
                <span className="truncate">Download QR Code</span>
            </button>
            <button
                onClick={() => {
                    // Share functionality or fallback to copy
                    if (navigator.share) {
                        navigator.share({
                            title: 'QR Code',
                            text: 'Check out this QR code',
                            url: window.location.href
                        });
                    } else {
                        navigator.clipboard.writeText(window.location.href);
                        toast.success("Link copied to clipboard");
                    }
                }}
                className="flex h-12 min-w-[84px] max-w-[480px] flex-1 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl bg-zinc-200 px-5 pl-5 text-base font-bold leading-normal tracking-[0.015em] text-zinc-900 dark:bg-zinc-800 dark:text-white"
            >
                <span className="material-symbols-outlined">share</span>
                <span className="truncate">Share Link</span>
            </button>
        </>
    );
}
