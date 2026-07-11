// Guest claim tokens live in localStorage until the user signs in, then
// M2's /api/claim attaches the prompts to their account (SPEC §5.1, §5 M2).

const STORAGE_KEY = "pk:claims";

export type Claim = {
    slug: string;
    claimToken: string;
    createdAt: string;
};

export function getClaims(): Claim[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function addClaim(claim: Omit<Claim, "createdAt">): void {
    try {
        const claims = getClaims();
        if (claims.some((c) => c.slug === claim.slug)) return;
        claims.push({ ...claim, createdAt: new Date().toISOString() });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(claims));
    } catch {
        // localStorage unavailable (private mode etc.) — claiming is best-effort.
    }
}

export function clearClaims(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // ignore
    }
}
