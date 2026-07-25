import { auth } from "@/auth";
import { User } from "./models";
import { sha256Hex } from "./encryption";

/**
 * API caller resolution (SPEC §6): session cookie OR
 * `Authorization: Bearer <apiToken>` (the extension's fallback when
 * cross-site cookies aren't sent). Returns the user id or null (guest).
 */
export async function resolveApiUserId(request: Request): Promise<string | null> {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice("Bearer ".length).trim();
        if (token) {
            const user = await User.findOne({ apiToken: sha256Hex(token) }).select("_id");
            if (user) return String(user._id);
        }
        return null; // an invalid token doesn't fall through to cookies
    }

    const session = await auth();
    return session?.user?.id ?? null;
}

// Browser-extension origins only (SPEC §6: "CORS: allow extension
// origins for /api/*"). Credentialed requests require echoing the
// exact origin rather than "*".
const EXTENSION_ORIGIN = /^(chrome-extension|moz-extension|safari-web-extension):\/\//;

export function corsHeaders(request: Request): Record<string, string> {
    const origin = request.headers.get("origin");
    if (!origin || !EXTENSION_ORIGIN.test(origin)) return {};
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        Vary: "Origin",
    };
}

export function preflight(request: Request): Response {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
}
