import { Prompt } from "@/lib/models";
import dbConnect from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { notFound } from "next/navigation";
import { CopyBlock } from "@/components/view/copy-block";

async function getPrompt(slug: string) {
    await dbConnect();
    console.log(`Fetching prompt for slug: ${slug}`);
    const prompt = await Prompt.findOne({ shortSlug: slug });

    if (!prompt) {
        console.log("Prompt not found in database");
        return null;
    }

    return prompt;
}

export default async function ResolvePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const prompt = await getPrompt(slug);

    if (!prompt) {
        notFound();
    }

    // Decrypt content
    let content = "";
    try {
        console.log(`[Debug] Decrypting slug: ${slug}`);
        console.log(`[Debug] IV (${prompt.iv?.length} chars): ${prompt.iv}`);
        console.log(`[Debug] Content (${prompt.encryptedContent?.length} chars): ${prompt.encryptedContent?.substring(0, 20)}...`);

        if (!prompt.iv || prompt.iv.length !== 32) {
            console.error("[Debug] Invalid IV length. Expected 32 hex chars.");
        }

        content = decrypt(prompt.iv, prompt.encryptedContent);
    } catch (error) {
        console.error("Decryption failed:", error);
        return <div>Error decrypting content. The key might be invalid.</div>;
    }

    // Handle one-time view
    if (prompt.options?.isOneTimeView) {
        if (prompt.scanCount > 0) {
            return (
                <div className="flex h-screen items-center justify-center p-4 text-center">
                    <div>
                        <h1 className="text-2xl font-bold text-red-500">Expired</h1>
                        <p className="mt-2 text-gray-600 dark:text-gray-400">This prompt was a one-time view and has already been viewed.</p>
                    </div>
                </div>
            );
        }
        // Increment scan count
        await Prompt.updateOne({ _id: prompt._id }, { $inc: { scanCount: 1 } });
    } else {
        // Increment scan count for persistent prompts too
        await Prompt.updateOne({ _id: prompt._id }, { $inc: { scanCount: 1 } });
    }

    return (
        <div className="relative flex h-auto min-h-screen w-full flex-col bg-background-light dark:bg-background-dark group/design-root overflow-x-hidden">
            {/* Top App Bar */}
            <div className="flex items-center bg-background-light dark:bg-background-dark p-4 pb-2 justify-between sticky top-0 z-10">
                <div className="flex size-12 shrink-0 items-center justify-start">
                    {/* Close button could go back home or close window */}
                    <a href="/" className="material-symbols-outlined text-slate-900 dark:text-white/90 no-underline">close</a>
                </div>
                <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">Text Display</h2>
                <div className="flex size-12 shrink-0 items-center"></div>
            </div>

            <div className="flex flex-col flex-grow px-4">
                {/* Headline Text */}
                <h1 className="text-slate-900 dark:text-white tracking-light text-[32px] font-bold leading-tight text-left pb-3 pt-6">Your Text</h1>

                {/* Text Display Area */}
                <div className="bg-slate-200/50 dark:bg-background-dark/50 p-4 rounded-lg flex-grow mb-4 border border-slate-300 dark:border-slate-700">
                    <p className="text-slate-800 dark:text-white/80 text-base font-normal leading-relaxed whitespace-pre-wrap break-words">
                        {content}
                    </p>
                </div>
            </div>

            {/* Pinned Footer Button */}
            <div className="sticky bottom-0 w-full bg-background-light dark:bg-background-dark pt-2 pb-4">
                <div className="flex px-4 py-3">
                    <CopyBlock content={content} />
                </div>
            </div>
        </div>
    );
}
