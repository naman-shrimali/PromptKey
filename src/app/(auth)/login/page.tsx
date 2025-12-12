import { LoginForm } from "@/components/forms/login-form";

export default function LoginPage() {
    return (
        <div className="relative flex h-auto min-h-screen w-full flex-col bg-background-light dark:bg-background-dark">
            <div className="flex flex-1 flex-col items-center justify-center p-4">
                <div className="w-full max-w-sm">
                    {/* Header */}
                    <div className="text-center">
                        <h1 className="text-slate-900 dark:text-white tracking-tight text-3xl font-bold leading-tight pt-6 pb-2 font-display">QR Share</h1>
                        <p className="text-slate-600 dark:text-slate-400 text-base font-normal leading-normal pb-8 font-display">Securely share your notes.</p>
                    </div>

                    <LoginForm />

                    {/* Footer Links */}
                    <div className="pt-8 text-center">
                        <p className="text-slate-600 dark:text-slate-400 text-sm font-normal">New here? <a href="#" className="font-bold text-primary hover:underline">Sign Up</a></p>
                        <p className="text-slate-500 dark:text-slate-500 text-xs font-normal pt-4">Coming from a guest session? <a href="#" className="font-bold text-primary/80 hover:underline">Migrate your data.</a></p>
                    </div>
                </div>
            </div>
            {/* Legal Footer */}
            <div className="pb-6 px-4">
                <p className="text-slate-500 dark:text-slate-600 text-xs text-center">By continuing, you agree to our <a href="#" className="underline hover:text-primary">Terms</a> and <a href="#" className="underline hover:text-primary">Privacy Policy</a>.</p>
            </div>
        </div>
    );
}
