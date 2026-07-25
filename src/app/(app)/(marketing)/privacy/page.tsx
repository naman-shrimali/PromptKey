import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Privacy Policy · PromptKey",
    description: "What PromptKey collects, why, and how to control or delete it.",
};

const LAST_UPDATED = "July 25, 2026";

const h2 = "mt-8 font-display text-xl font-bold";
const h3 = "mt-5 font-display text-base font-bold";
const p = "mt-2 text-[15px] leading-relaxed text-muted-foreground";
const ul = "mt-2 flex flex-col gap-1.5 text-[15px] leading-relaxed text-muted-foreground";
const li = "pl-4 relative before:absolute before:left-0 before:content-['·'] before:font-bold before:text-foreground";

export default function PrivacyPage() {
    return (
        <div className="mx-auto w-full max-w-2xl px-5 pb-24 pt-6">
            <h1 className="font-display text-3xl font-bold">Privacy Policy</h1>
            <p className="mt-1 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>

            <p className={p}>
                PromptKey (&ldquo;we,&rdquo; &ldquo;us&rdquo;) moves text between devices via QR
                codes and short links — on the web, and through the PromptKey browser extension.
                This page explains what we collect, why, who we share it with, and how you can
                control or delete it. It applies to both.
            </p>

            <h2 className={h2}>What we collect</h2>

            <h3 className={h3}>The text you share</h3>
            <p className={p}>
                When you create a QR code or link, its content is encrypted (AES-256-GCM) and
                stored only until it expires or you delete it. Two modes change what we ever see:
            </p>
            <ul className={ul}>
                <li className={li}>
                    <b className="text-foreground">Offline QR</b> (short text) — encoded directly
                    into the QR image in your browser or the extension. It never touches our
                    servers.
                </li>
                <li className={li}>
                    <b className="text-foreground">Link QR</b> (longer text) — sent to our server,
                    encrypted at rest, and decrypted only to display it to whoever opens the link.
                </li>
                <li className={li}>
                    <b className="text-foreground">Private / end-to-end mode</b> — encrypted in
                    your browser before it ever leaves your device. The decryption key travels
                    only inside the QR/link itself (in the URL fragment), which browsers never
                    send to us. We cannot read this content under any circumstances.
                </li>
            </ul>

            <h3 className={h3}>Account information</h3>
            <p className={p}>
                If you sign in: your email address and, if you use Google sign-in, the name and
                profile image Google shares with us. If you use email sign-in, we send a one-time
                sign-in link and don&rsquo;t store a password.
            </p>

            <h3 className={h3}>Usage analytics (owners only)</h3>
            <p className={p}>
                For QR codes you own, we log when they&rsquo;re scanned so you can see basic
                stats: a daily scan count, a coarse device type (mobile or desktop, from the
                browser&rsquo;s user-agent string), and the referring website&rsquo;s domain
                only — never the full URL, and never anything that identifies the individual
                scanning it. These logs are automatically deleted after 90 days.
            </p>

            <h3 className={h3}>Browser extension data</h3>
            <p className={p}>The PromptKey extension stores, only on your own device:</p>
            <ul className={ul}>
                <li className={li}>
                    The PromptKey server address and API token you configure, so you don&rsquo;t
                    need to re-enter them.
                </li>
                <li className={li}>
                    A short local history (your 5 most recent items) so you can find them again
                    from the popup.
                </li>
            </ul>
            <p className={p}>
                Text you select and turn into a QR/link through the extension is handled exactly
                like the web app: kept on your device for offline QR codes, sent to our server
                (encrypted) for link QR codes. The extension does not read any page content unless
                you explicitly trigger it — via the right-click menu, the keyboard shortcut, or
                the toolbar popup. It does not run in the background and does not access pages you
                haven&rsquo;t interacted with it on.
            </p>

            <h3 className={h3}>Payments (prompt marketplace)</h3>
            <p className={p}>
                Purchases and subscriptions are processed by Razorpay. We store the resulting
                order/subscription IDs, amount, and status — never your card or bank details,
                which Razorpay handles directly.
            </p>

            <h2 className={h2}>Why we collect it</h2>
            <ul className={ul}>
                <li className={li}>To create, store, and deliver the QR codes and links you make.</li>
                <li className={li}>To authenticate you and keep your library of QR codes.</li>
                <li className={li}>To show you scan analytics for content you own.</li>
                <li className={li}>To process marketplace purchases and subscriptions.</li>
                <li className={li}>To prevent abuse (rate limiting by IP address, not tied to an account unless you&rsquo;re signed in).</li>
            </ul>
            <p className={p}>We do not sell your data, and we do not use it to train AI models.</p>

            <h2 className={h2}>Who we share it with</h2>
            <p className={p}>
                We use a small number of service providers to run PromptKey. Each only receives
                what it needs to do its job:
            </p>
            <ul className={ul}>
                <li className={li}><b className="text-foreground">MongoDB Atlas</b> — database hosting.</li>
                <li className={li}><b className="text-foreground">Vercel</b> — application hosting.</li>
                <li className={li}><b className="text-foreground">Google</b> — optional sign-in (OAuth).</li>
                <li className={li}><b className="text-foreground">Resend</b> — delivery of sign-in emails.</li>
                <li className={li}><b className="text-foreground">Razorpay</b> — payment processing for the marketplace.</li>
            </ul>
            <p className={p}>
                We don&rsquo;t share your data with anyone else, and none of these providers may
                use it for their own purposes.
            </p>

            <h2 className={h2}>How long we keep it</h2>
            <ul className={ul}>
                <li className={li}>QR codes/links expire automatically based on the option you chose (1 hour up to never, for signed-in users).</li>
                <li className={li}>Deleted QR codes are soft-deleted immediately and permanently purged within 30 days.</li>
                <li className={li}>Scan analytics are purged after 90 days.</li>
                <li className={li}>Deleting your account removes your profile and schedules all your content for permanent deletion within 30 days.</li>
            </ul>

            <h2 className={h2}>Your controls</h2>
            <ul className={ul}>
                <li className={li}>Edit or delete any QR code from your dashboard at any time.</li>
                <li className={li}>Revoke your API token from Settings, which immediately blocks extension access.</li>
                <li className={li}>Delete your account from Settings — this is permanent and cannot be undone.</li>
                <li className={li}>Uninstalling the browser extension removes everything it stored locally.</li>
            </ul>

            <h2 className={h2}>Security</h2>
            <p className={p}>
                All content is encrypted at rest (AES-256-GCM) and in transit (HTTPS). Slugs are
                unguessable and never indexed by search engines. We never render your text as
                HTML, which rules out an entire class of injection attacks against people who
                scan your codes.
            </p>

            <h2 className={h2}>Children</h2>
            <p className={p}>
                PromptKey is not directed at children under 13, and we don&rsquo;t knowingly
                collect data from them.
            </p>

            <h2 className={h2}>Changes to this policy</h2>
            <p className={p}>
                If this policy changes materially, we&rsquo;ll update the date at the top of this
                page. Continuing to use PromptKey after a change means you accept the update.
            </p>

            <h2 className={h2}>Contact</h2>
            <p className={p}>
                Questions about this policy or your data:{" "}
                <a
                    href="mailto:shrimalinaman888@gmail.com"
                    className="font-semibold text-primary hover:underline"
                >
                    shrimalinaman888@gmail.com
                </a>
            </p>
        </div>
    );
}
