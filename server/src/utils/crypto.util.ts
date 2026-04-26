import * as crypto from 'crypto';
import { getRequiredSecret } from '../common/utils/secret.util';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const LEGACY_DEV_FALLBACK_KEY = Buffer.from('12345678901234567890123456789012', 'utf-8');

let _encryptionKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
    if (!_encryptionKey) {
        _encryptionKey = Buffer.from(
            getRequiredSecret('ENCRYPTION_KEY', {
                exactLength: 32,
                disallowValues: ['12345678901234567890123456789012', 'your-32-char-encryption-key'],
            }),
            'utf-8',
        );
    }
    return _encryptionKey;
}

function isProduction() {
    return process.env.NODE_ENV === 'production';
}

function getLegacyKeys(): Buffer[] {
    const keys: Buffer[] = [];
    const configured = (process.env.LEGACY_ENCRYPTION_KEYS || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

    for (const key of configured) {
        if (Buffer.byteLength(key, 'utf8') === 32) {
            keys.push(Buffer.from(key, 'utf-8'));
        }
    }

    if (!isProduction()) {
        keys.push(LEGACY_DEV_FALLBACK_KEY);
    }

    return keys.filter((key, index, array) =>
        array.findIndex((candidate) => candidate.equals(key)) === index,
    );
}

function decryptWithKey(encryptedText: Buffer, iv: Buffer, authTag: Buffer, key: Buffer) {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

/**
 * Encrypts a plain text string using AES-256-GCM.
 * @param text The plain text to encrypt.
 * @returns A base64-encoded string containing the IV, encrypted data, and auth tag.
 */
export function encryptAttribute(text: string): string {
    if (!text) return text;
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag();

        // Format: version:iv:authTag:encryptedText
        // We use base64 encoding for the final packaged string for compact storage
        const payload = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')]);
        return `v1:${payload.toString('base64')}`;
    } catch (error) {
        console.error('Encryption failed:', error);
        throw new Error('Failed to encrypt database credentials.');
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

        try {
            return decryptWithKey(encryptedText, iv, authTag, getEncryptionKey());
        } catch (primaryError) {
            for (const legacyKey of getLegacyKeys()) {
                if (legacyKey.equals(getEncryptionKey())) {
                    continue;
                }

                try {
                    return decryptWithKey(encryptedText, iv, authTag, legacyKey);
                } catch {
                    // try next legacy key
                }
            }

            throw primaryError;
        }
    } catch (error) {
        console.error('Decryption failed for payload:', error);
        throw new Error('Failed to decrypt database credentials.');
    }
}
