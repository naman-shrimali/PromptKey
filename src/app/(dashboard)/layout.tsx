import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();

    if (!session) {
        redirect("/login");
    }

    return (
        <div className="bg-background-light dark:bg-background-dark font-display min-h-screen">
            {children}
        </div>
    );
}
