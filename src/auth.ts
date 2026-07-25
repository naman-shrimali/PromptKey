import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Resend from "next-auth/providers/resend"
import { MongoDBAdapter } from "@auth/mongodb-adapter"
import clientPromise from "@/lib/mongodb-adapter"

const EMAIL_FROM = process.env.EMAIL_FROM || "PromptKey <login@promptkey.app>"

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: MongoDBAdapter(clientPromise),
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
        Resend({
            from: EMAIL_FROM,
            apiKey: process.env.RESEND_API_KEY,
            async sendVerificationRequest({ identifier, url, provider }) {
                // Dev fallback: without a Resend key, surface the magic link
                // in the server console so login stays testable locally.
                if (!process.env.RESEND_API_KEY) {
                    if (process.env.NODE_ENV === "production") {
                        throw new Error("RESEND_API_KEY is required to send magic links");
                    }
                    console.warn(`\n[dev] Magic link for ${identifier}:\n${url}\n`);
                    return;
                }
                const res = await fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${provider.apiKey}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        from: provider.from,
                        to: identifier,
                        subject: "Your PromptKey sign-in link",
                        text: `Sign in to PromptKey:\n${url}\n\nThis link expires in 24 hours. If you didn't request it, ignore this email.`,
                        html: [
                            `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">`,
                            `<h2 style="color:#241f36">🔑 Sign in to PromptKey</h2>`,
                            `<p><a href="${url}" style="display:inline-block;background:#7c5cfc;color:#fff;text-decoration:none;font-weight:600;padding:12px 28px;border-radius:12px">Sign in</a></p>`,
                            `<p style="color:#6e6884;font-size:13px">This link expires in 24 hours. If you didn't request it, you can safely ignore this email.</p>`,
                            `</div>`,
                        ].join(""),
                    }),
                });
                if (!res.ok) {
                    throw new Error(`Resend error: ${await res.text()}`);
                }
            },
        }),
    ],
    pages: {
        signIn: "/login",
        verifyRequest: "/login?sent=1",
    },
    callbacks: {
        session({ session, user }) {
            if (session.user) {
                session.user.id = user.id
            }
            return session
        },
    },
})
