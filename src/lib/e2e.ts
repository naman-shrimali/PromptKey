// End-to-end encryption helpers (SPEC §5 M4). Everything here runs in
// the *browser* via WebCrypto: the AES-GCM key is generated client-side
// and travels only in the URL fragment (#k=…), which user agents never
// send to the server. The server stores ciphertext it cannot read.

export function bytesToB64url(bytes: Uint8Array): string {
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
        bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlToBytes(b64url: string): Uint8Array<ArrayBuffer> {
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    // Explicit ArrayBuffer keeps WebCrypto's BufferSource typing happy
    const bytes = new Uint8Array(new ArrayBuffer(bin.length));
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

export type E2ePayload = {
    ciphertext: string; // b64url, GCM tag included (WebCrypto appends it)
    iv: string; // b64url, 12 bytes
    key: string; // b64url raw key — goes in the fragment, NEVER the body
};

export async function e2eEncrypt(text: string): Promise<E2ePayload> {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
        "encrypt",
        "decrypt",
    ]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = new Uint8Array(
        await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(text))
    );
    const rawKey = new Uint8Array(await crypto.subtle.exportKey("raw", key));
    return {
        ciphertext: bytesToB64url(ciphertext),
        iv: bytesToB64url(iv),
        key: bytesToB64url(rawKey),
    };
}

export async function e2eDecrypt(payload: {
    ciphertext: string;
    iv: string;
    key: string;
}): Promise<string> {
    const key = await crypto.subtle.importKey(
        "raw",
        b64urlToBytes(payload.key),
        { name: "AES-GCM" },
        false,
        ["decrypt"]
    );
    const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: b64urlToBytes(payload.iv) },
        key,
        b64urlToBytes(payload.ciphertext)
    );
    return new TextDecoder().decode(plain);
}
