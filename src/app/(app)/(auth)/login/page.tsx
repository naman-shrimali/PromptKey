import { LoginForm } from "@/components/forms/login-form";

export default async function LoginPage({
    searchParams,
}: {
    searchParams: Promise<{ sent?: string }>;
}) {
    const { sent } = await searchParams;

    return (
        <div className="mx-auto flex w-full max-w-md flex-col px-5 pb-20 pt-10 sm:pt-16">
            <h1 className="text-center font-display text-3xl font-bold">Welcome back</h1>
            <p className="mt-2 pb-8 text-center text-sm text-muted-foreground">
                Sign in to keep, edit, and track your QR codes.
            </p>

            <LoginForm linkSent={sent === "1"} />

            <p className="pt-8 text-center text-xs text-muted-foreground">
                Made QRs as a guest? They&apos;ll be saved to your account when you sign in. 💾
            </p>
        </div>
    );
}
