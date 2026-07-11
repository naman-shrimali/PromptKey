import { auth } from "@/auth";
import { Prompt } from "@/lib/models";
import dbConnect from "@/lib/db";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { QRActions } from "@/components/qr/qr-actions";
import { QRGenerator } from "@/components/qr/qr-generator";

async function getPrompt(id: string, userId: string) {
    await dbConnect();
    const prompt = await Prompt.findOne({ _id: id, ownerUserId: userId });
    return prompt;
}

export default async function PromptDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user) {
        redirect("/login");
    }

    const { id } = await params;
    const prompt = await getPrompt(id, session.user.id as string);

    if (!prompt) {
        notFound();
    }

    const promptUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/${prompt.shortSlug}`;

    return (
        <div className="relative flex min-h-screen w-full flex-col group/design-root overflow-x-hidden bg-background-light dark:bg-background-dark font-display">
            {/* Top App Bar */}
            <div className="flex items-center bg-background-light dark:bg-background-dark p-4 pb-2 justify-between sticky top-0 z-10 border-b border-white/10">
                <div className="text-white flex size-10 items-center justify-center">
                    <Link href="/dashboard">
                        <span className="material-symbols-outlined text-2xl text-slate-800 dark:text-white">arrow_back_ios_new</span>
                    </Link>
                </div>
                <h2 className="text-slate-800 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">QR Code Details</h2>
                <div className="flex size-10 shrink-0 items-center"></div>
            </div>

            <div className="flex w-full flex-col gap-6 p-4">
                {/* QR Code Section */}
                <div className="flex flex-col items-center gap-4 rounded-xl bg-slate-200/50 dark:bg-slate-800/40 p-6">
                    <div className="relative w-48 h-48 bg-white p-2 rounded-lg">
                        <div id="qr-code-details" className="w-full h-full">
                            <QRGenerator url={promptUrl} />
                        </div>
                    </div>
                    <div className="flex w-full items-center justify-between gap-4 rounded-lg bg-background-light dark:bg-background-dark px-4 py-3">
                        <div className="flex items-center gap-4 overflow-hidden">
                            <div className="text-primary flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-2xl">link</span>
                            </div>
                            <p className="text-slate-700 dark:text-white text-base font-normal leading-normal flex-1 truncate">{promptUrl}</p>
                        </div>
                        <div className="shrink-0">
                            {/* Copy button logic would go here, maybe a client component */}
                            <div className="text-slate-600 dark:text-slate-300 flex size-7 items-center justify-center cursor-pointer">
                                <span className="material-symbols-outlined text-2xl">content_copy</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Analytics Section */}
                <div>
                    <h3 className="text-slate-800 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] px-0 pb-2 pt-2">Scan Analytics</h3>
                    <div className="flex flex-col gap-4 rounded-xl bg-slate-200/50 dark:bg-slate-800/40 p-4">
                        <div className="flex justify-around">
                            <div className="flex flex-col items-center">
                                <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">Total Scans</p>
                                <p className="text-slate-800 dark:text-white text-2xl font-bold">{prompt.scanCount}</p>
                            </div>
                            <div className="w-px bg-slate-300 dark:bg-slate-700"></div>
                            <div className="flex flex-col items-center">
                                <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">Unique Scans</p>
                                <p className="text-slate-800 dark:text-white text-2xl font-bold">{/* Unique scans not tracked yet */}-{/* Placeholder */}</p>
                            </div>
                        </div>
                        <div className="flex min-h-[120px] flex-1 flex-col gap-2 pt-4">
                            {/* Placeholder Chart */}
                            <svg fill="none" height="100" preserveAspectRatio="none" viewBox="-3 0 478 102" width="100%" xmlns="http://www.w3.org/2000/svg">
                                <path d="M0 74.4545C18.1538 74.4545 18.1538 14.3636 36.3077 14.3636C54.4615 14.3636 54.4615 27.9091 72.6154 27.9091C90.7692 27.9091 90.7692 63.5 108.923 63.5C127.077 63.5 127.077 22.4091 145.231 22.4091C163.385 22.4091 163.385 68.8636 181.538 68.8636C199.692 68.8636 199.692 41.5909 217.846 41.5909C236 41.5909 236 30.6364 254.154 30.6364C272.308 30.6364 272.308 82.6364 290.462 82.6364C308.615 82.6364 308.615 101 326.769 101C344.923 101 344.923 0.681818 363.077 0.681818C381.231 0.681818 381.231 55.0455 399.385 55.0455C417.538 55.0455 417.538 88.0909 435.692 88.0909C453.846 88.0909 453.846 17.0909 472 17.0909V101H326.769H0V74.4545Z" fill="url(#paint0_linear_chart)"></path>
                                <path d="M0 74.4545C18.1538 74.4545 18.1538 14.3636 36.3077 14.3636C54.4615 14.3636 54.4615 27.9091 72.6154 27.9091C90.7692 27.9091 90.7692 63.5 108.923 63.5C127.077 63.5 127.077 22.4091 145.231 22.4091C163.385 22.4091 163.385 68.8636 181.538 68.8636C199.692 68.8636 199.692 41.5909 217.846 41.5909C236 41.5909 236 30.6364 254.154 30.6364C272.308 30.6364 272.308 82.6364 290.462 82.6364C308.615 82.6364 308.615 101 326.769 101C344.923 101 344.923 0.681818 363.077 0.681818C381.231 0.681818 381.231 55.0455 399.385 55.0455C417.538 55.0455 417.538 88.0909 435.692 88.0909C453.846 88.0909 453.846 17.0909 472 17.0909" stroke="#13a4ec" strokeLinecap="round" strokeWidth="3"></path>
                                <defs>
                                    <linearGradient gradientUnits="userSpaceOnUse" id="paint0_linear_chart" x1="236" x2="236" y1="0.681818" y2="101">
                                        <stop stopColor="#13a4ec" stopOpacity="0.4"></stop>
                                        <stop offset="1" stopColor="#13a4ec" stopOpacity="0"></stop>
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Destination Text Section */}
                <div className="flex flex-col gap-2">
                    <label className="text-slate-800 dark:text-white text-base font-bold leading-tight" htmlFor="destination-text">Destination Text</label>
                    <textarea
                        className="w-full rounded-lg border-2 border-slate-300 dark:border-slate-700 bg-slate-200/50 dark:bg-slate-800/40 p-3 text-slate-700 dark:text-slate-200 focus:border-primary focus:ring-primary placeholder:text-slate-500"
                        id="destination-text"
                        rows={4}
                        readOnly
                        value="Encrypted Content (Hidden for security)"
                    ></textarea>
                </div>

                {/* Actions Section */}
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 rounded-xl bg-slate-200/50 dark:bg-slate-800/40 p-4">
                        <label className="flex cursor-pointer items-center justify-between" htmlFor="preserve-link">
                            <span className="text-slate-700 dark:text-slate-200 font-medium">Preserve current short link</span>
                            <div className="relative">
                                <input defaultChecked className="peer sr-only" id="preserve-link" type="checkbox" />
                                <div className="block h-8 w-14 rounded-full bg-slate-400 dark:bg-slate-600"></div>
                                <div className="dot absolute left-1 top-1 h-6 w-6 rounded-full bg-white transition peer-checked:translate-x-full peer-checked:bg-primary"></div>
                            </div>
                        </label>
                        <button className="w-full rounded-lg bg-primary/20 px-6 py-3 text-center text-base font-bold text-primary">Regenerate Now</button>
                    </div>
                    <div className="flex flex-col gap-3 pt-2">
                        <button className="w-full rounded-lg bg-primary px-6 py-4 text-center text-base font-bold text-white opacity-50 cursor-not-allowed" disabled>Save Changes</button>
                        <button className="w-full rounded-lg px-6 py-3 text-center text-base font-bold text-red-500">Delete QR Code</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
