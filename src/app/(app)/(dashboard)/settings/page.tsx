import { redirect } from "next/navigation";
import { auth } from "@/auth";
import dbConnect from "@/lib/db";
import { User } from "@/lib/models";
import { SettingsPanel } from "@/components/dashboard/settings-panel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
    const session = await auth();
    if (!session?.user) redirect("/login");

    await dbConnect();
    const user = await User.findById(session.user.id).lean<{
        name?: string;
        email?: string;
        image?: string;
        apiToken?: string | null;
    }>();
    if (!user) redirect("/login");

    return (
        <div className="mx-auto w-full max-w-xl px-5 pb-20 pt-4">
            <h1 className="font-display text-2xl font-bold">Settings</h1>
            <div className="mt-5">
                <SettingsPanel
                    user={{
                        name: user.name ?? "",
                        email: user.email ?? "",
                        image: user.image ?? null,
                    }}
                    hasApiToken={!!user.apiToken}
                />
            </div>
        </div>
    );
}
