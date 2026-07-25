import crypto from "crypto";

// AES-256-GCM: authenticated encryption — decrypt fails loudly if the
// ciphertext, IV, or auth tag was tampered with (SPEC §2).
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // GCM standard nonce size
const HKDF_INFO = "promptkey:content-encryption:v1";

let cachedKey: Buffer | null = null;

// The raw env string is key *material*, not the key itself — derive the
// actual key via HKDF so its length/entropy shape doesn't matter.
function getKey(): Buffer {
    if (cachedKey) return cachedKey;
    const secret = process.env.ENCRYPTION_KEY;
    if (!secret) {
        throw new Error("ENCRYPTION_KEY environment variable is not set");
    }
    cachedKey = Buffer.from(
        crypto.hkdfSync("sha256", secret, Buffer.alloc(0), HKDF_INFO, 32)
    );
    return cachedKey;
}

export function encrypt(text: string) {
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
    return {
        iv: iv.toString("hex"),
        content: encrypted.toString("hex"),
        authTag: cipher.getAuthTag().toString("hex"),
    };
}

export function decrypt(ivHex: string, encryptedHex: string, authTagHex: string): string {
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    return Buffer.concat([
        decipher.update(Buffer.from(encryptedHex, "hex")),
        decipher.final(),
    ]).toString("utf8");
}

export function sha256Hex(text: string): string {
    return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}
