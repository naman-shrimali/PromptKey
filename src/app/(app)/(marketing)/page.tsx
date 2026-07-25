import { auth } from "@/auth";
import { CreateFlow } from "@/components/create/create-flow";

export default async function Home() {
    const session = await auth();

    return (
        <div className="mx-auto w-full max-w-[1060px] px-2 pb-20 pt-6 sm:pt-10">
            <h1 className="text-center font-display text-4xl font-bold leading-tight sm:text-5xl">
                Paste it. <span className="text-primary">QR it.</span> Share it.
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-center text-base text-muted-foreground">
                Long text in, tiny scannable link out — encrypted, no account needed.
            </p>

            <div className="mt-8">
                <CreateFlow isLoggedIn={!!session?.user} />
            </div>
        </div>
    );
}
