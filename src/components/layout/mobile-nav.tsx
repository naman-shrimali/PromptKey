"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const LINKS = [
    { href: "/", label: "Make" },
    { href: "/dashboard", label: "Library" },
    { href: "/market", label: "Market" },
];

// Nav links are `hidden sm:flex` in GlobalHeader — this is the mobile
// fallback so Library/Market stay reachable below that breakpoint.
export function MobileNav() {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
        const onClick = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("keydown", onKey);
        document.addEventListener("mousedown", onClick);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("mousedown", onClick);
        };
    }, [open]);

    return (
        <div ref={rootRef} className="relative sm:hidden">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-label="Open menu"
                className="flex size-9 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-border bg-card transition-colors hover:border-ring"
            >
                <span aria-hidden="true" className="text-base">
                    {open ? "✕" : "☰"}
                </span>
            </button>

            {open && (
                <div
                    role="menu"
                    className="absolute right-0 top-[calc(100%+8px)] z-50 min-w-40 overflow-hidden rounded-2xl border-[1.5px] border-border bg-card shadow-[0_12px_32px_rgba(0,0,0,0.18)]"
                >
                    {LINKS.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            role="menuitem"
                            onClick={() => setOpen(false)}
                            className="block px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
                        >
                            {link.label}
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
