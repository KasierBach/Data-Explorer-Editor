import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
// Ensure the key is exactly 32 bytes (256 bits) for aes-256-gcm
// Ideally, provide a 32-character string in the .env file
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY || '12345678901234567890123456789012', 'utf-8');
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

const DEFAULT_KEY_FALLBACK = Buffer.from('12345678901234567890123456789012', 'utf-8');

/**
 * Encrypts a plain text string using AES-256-GCM.
 * @param text The plain text to encrypt.
 * @returns A base64-encoded string containing the IV, encrypted data, and auth tag.
 */
export function encryptAttribute(text: string): string {
    if (!text) return text;
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag();

        // Format: version:iv:authTag:encryptedText
        // We use base64 encoding for the final packaged string for compact storage
        const payload = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')]);
        return `v1:${payload.toString('base64')}`;
    } catch (error) {
        console.error('Encryption failing fallback to raw:', error);
        return text;
    }
}

/**
 * Decrypts a base64-encoded string back to plain text using AES-256-GCM.
 * @param encryptedPayload The encrypted string.
 * @returns The decrypted plain text.
 */
export function decryptAttribute(encryptedPayload: string): string {
    if (!encryptedPayload) return encryptedPayload;
    if (!encryptedPayload.startsWith('v1:')) {
        // Fallback for existing plaintext passwords in db before this patch
        return encryptedPayload;
    }

    try {
        const base64Payload = encryptedPayload.substring(3);
        const buffer = Buffer.from(base64Payload, 'base64');

        const iv = buffer.subarray(0, IV_LENGTH);
        const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
        const encryptedText = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

        const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
        decipher.setAuthTag(authTag);

        try {
            let decrypted = decipher.update(encryptedText, undefined, 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch (error) {
            // If main key fails, try the default fallback key (for legacy items)
            if (ENCRYPTION_KEY.toString() !== DEFAULT_KEY_FALLBACK.toString()) {
                try {
                    const fallbackDecipher = crypto.createDecipheriv(ALGORITHM, DEFAULT_KEY_FALLBACK, iv);
                    fallbackDecipher.setAuthTag(authTag);
                    let decrypted = fallbackDecipher.update(encryptedText, undefined, 'utf8');
                    decrypted += fallbackDecipher.final('utf8');
                    return decrypted;
                } catch (fallbackError) {
                    throw error; // throw original error if fallback also fails
                }
            }
            throw error;
        }
    } catch (error) {
        console.error('Decryption failed for payload:', error);
        throw new Error('Failed to decrypt database credentials.');
    }
}
