import { PromptInput } from "@/components/forms/prompt-input";

export default function Home() {
    return (
        <>
            {/* Headline & Body Text */}
            <h2 className="text-slate-900 dark:text-white tracking-light text-[32px] font-bold leading-tight text-left pb-1">Generate a New QR Code</h2>
            <p className="text-slate-500 dark:text-slate-400 text-base font-normal leading-normal pb-6">Paste your long text or URL below to create a shareable QR code.</p>

            <PromptInput />
        </>
    );
}
