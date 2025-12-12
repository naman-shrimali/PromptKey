"use client";

import { useState } from "react";
import { toast } from "sonner";

export function CopyBlock({ content }: { content: string }) {
    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        toast.success("Copied to clipboard!");
    };

    return (
        <button
            onClick={handleCopy}
            className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-5 flex-1 bg-primary text-white gap-2 pl-5 text-base font-bold leading-normal tracking-[0.015em] hover:bg-primary/90 transition-colors"
        >
            <span className="material-symbols-outlined">content_copy</span>
            <span className="truncate">Copy Text</span>
        </button>
    );
}
