import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const SECRET_KEY = process.env.ENCRYPTION_KEY!; // Must be 32 chars

export const encrypt = (text: string) => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(SECRET_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return {
        iv: iv.toString('hex'),
        content: encrypted.toString('hex')
    };
};

export const decrypt = (ivHex: string, encryptedHex: string) => {
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedText = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(SECRET_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
};
