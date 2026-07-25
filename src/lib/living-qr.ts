import { encrypt, sha256Hex } from "./encryption";
import { countChars } from "./qr-mode";

export const MAX_VERSIONS = 10;

type CipherFields = {
    encryptedContent: string;
    iv: string;
    authTag?: string | null;
};

type PromptLike = CipherFields & {
    versions?: Array<CipherFields & { editedAt?: Date }>;
};

/**
 * Living QR edit (SPEC §5 M2): the slug — and therefore every printed
 * QR — never changes. The current ciphertext is pushed onto `versions`
 * (last MAX_VERSIONS kept) and the new content takes its place.
 * Returns the $set payload; the caller applies it owner-scoped.
 */
export function buildContentUpdate(prompt: PromptLike, newContent: string) {
    const enc = encrypt(newContent);
    const versions = [
        ...(prompt.versions ?? []),
        {
            encryptedContent: prompt.encryptedContent,
            iv: prompt.iv,
            authTag: prompt.authTag ?? null,
            editedAt: new Date(),
        },
    ].slice(-MAX_VERSIONS);

    return {
        encryptedContent: enc.content,
        iv: enc.iv,
        authTag: enc.authTag,
        versions,
        title: newContent.slice(0, 60),
        charCount: countChars(newContent),
        contentHash: sha256Hex(newContent),
    };
}

/** Escape user input before building a $regex title search (SPEC §5 M2). */
export function escapeRegex(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
