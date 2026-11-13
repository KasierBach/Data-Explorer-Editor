const MIB = 1024 * 1024;

// Deliberately mirrors the server's current native PDF/JSON ceilings.
export const AI_ATTACHMENT_BOUNDS = Object.freeze({
    maxAttachments: 4,
    maxImageBytes: 2 * MIB,
    maxPdfBytes: 5 * MIB,
    maxPdfDataUrlCharacters: 7_000_000,
    maxTextBytes: MIB,
    maxExtractedCharacters: 50_000,
    maxAttachmentCharacters: 60_000,
    maxAggregateTextCharacters: 200_000,
    maxAggregateBytes: 7 * MIB,
    maxSerializedBytes: 10 * MIB,
    maxPdfPages: 100,
    signatureBytes: 16,
});

export const AI_BINARY_REATTACH_WARNING = 'Binary omitted from saved chat/draft; reattach the file to send it again.';
export const AI_WORKBOOK_REFUSAL = 'Workbook attachments are not supported safely here. Export the required sheet as CSV/TSV and attach it instead.';

const TEXT_EXTENSIONS = new Set([
    'txt', 'md', 'csv', 'tsv', 'json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'log',
    'js', 'ts', 'tsx', 'jsx', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'cs', 'cpp', 'c', 'h', 'hpp',
    'php', 'swift', 'dart', 'lua', 'r', 'sql', 'sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd',
    'html', 'css', 'scss', 'sass', 'less', 'vue', 'svelte', 'env', 'gitignore', 'dockerignore',
    'editorconfig', 'prettierrc', 'eslintrc', 'makefile', 'dockerfile',
]);
const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const TEXT_MIMES = new Set([
    'application/json', 'application/ld+json', 'application/xml', 'application/javascript',
    'application/typescript', 'application/sql', 'application/yaml', 'application/x-yaml',
    'application/toml', 'application/x-sh',
]);
const WORKBOOK_MIMES = new Set([
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel', 'application/vnd.oasis.opendocument.spreadsheet',
]);

export interface BoundedAiAttachment {
    type: string;
    label: string;
    data: string;
    preview?: string;
    rawData?: string;
    mimeType?: string;
}
export interface AiFileDeclaration { name: string; type: string; size: number }
export type AiFileKind = 'image' | 'pdf' | 'text';

function fail(message = 'Unsupported, invalid or oversized AI attachment.'): never {
    throw new Error(message);
}

function signatureMatches(mime: string, header: Uint8Array): boolean {
    const starts = (...bytes: number[]) => bytes.every((byte, index) => header[index] === byte);
    const ascii = (start: number, end: number) => String.fromCharCode(...header.subarray(start, end));
    if (mime === 'image/png') return starts(137, 80, 78, 71, 13, 10, 26, 10);
    if (mime === 'image/jpeg') return starts(255, 216, 255);
    if (mime === 'image/gif') return ['GIF87a', 'GIF89a'].includes(ascii(0, 6));
    if (mime === 'image/webp') return header.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
    if (mime === 'application/pdf') return /^%PDF-(?:1\.[0-9]|2\.0)/.test(ascii(0, 8));
    return false;
}

function looksBinary(header: Uint8Array): boolean {
    if (IMAGE_MIMES.some((mime) => signatureMatches(mime, header)) || signatureMatches('application/pdf', header)) return true;
    if ((header[0] === 80 && header[1] === 75) || (header[0] === 208 && header[1] === 207) ||
        (header[0] === 77 && header[1] === 90) || (header[0] === 127 && header[1] === 69 && header[2] === 76 && header[3] === 70)) return true;
    return header.some((byte) => byte === 0 || (byte < 32 && ![9, 10, 13].includes(byte)));
}

/** MIME and declared size first: call before even the 16-byte signature read. */
export function assertAiFileDeclaration(file: AiFileDeclaration): AiFileKind {
    if (typeof file.name !== 'string' || !file.name.length || file.name.length > 240 ||
        typeof file.type !== 'string' || !Number.isSafeInteger(file.size) || file.size <= 0) fail();
    const ext = file.name.split('.').pop()!.toLowerCase();
    // XLSX/ODS use compressed containers; XLS also has no finite parser gate here.
    // A small declared file size does not bound decompressed allocation. Fail closed.
    if (['xlsx', 'xls', 'ods'].includes(ext) || WORKBOOK_MIMES.has(file.type)) fail(AI_WORKBOOK_REFUSAL);
    if (IMAGE_MIMES.includes(file.type)) {
        if (file.size > AI_ATTACHMENT_BOUNDS.maxImageBytes) fail('Image attachments must be at most 2 MiB.');
        return 'image';
    }
    if (file.type === 'application/pdf') {
        if (file.size > AI_ATTACHMENT_BOUNDS.maxPdfBytes) fail('PDF attachments must be at most 5 MiB.');
        return 'pdf';
    }
    if (ext === 'pdf' || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext) || file.type.startsWith('image/')) fail();
    const recognizedMime = file.type.startsWith('text/') || TEXT_MIMES.has(file.type);
    const emptyMimeText = file.type === '' && (TEXT_EXTENSIONS.has(ext) || !file.name.includes('.') || file.name.startsWith('.'));
    if (!recognizedMime && !emptyMimeText) fail();
    if (file.size > AI_ATTACHMENT_BOUNDS.maxTextBytes) fail('Text/code/CSV attachments must be at most 1 MiB.');
    return 'text';
}

export function assertAiFileSignature(file: AiFileDeclaration, kind: AiFileKind, buffer: ArrayBuffer): void {
    const header = new Uint8Array(buffer);
    if (header.length !== Math.min(file.size, AI_ATTACHMENT_BOUNDS.signatureBytes)) fail('Attachment size declaration does not match its header.');
    if (kind === 'text' ? looksBinary(header) : !signatureMatches(file.type, header)) fail('Attachment MIME does not match its file signature.');
}

export function assertAiBinaryDataUrl(value: string, kind: 'image' | 'pdf', declaredBytes?: number): number {
    if (typeof value !== 'string') fail();
    const maxBytes = kind === 'image' ? AI_ATTACHMENT_BOUNDS.maxImageBytes : AI_ATTACHMENT_BOUNDS.maxPdfBytes;
    const maxCharacters = kind === 'image' ? 4 * Math.ceil(maxBytes / 3) + 32 : AI_ATTACHMENT_BOUNDS.maxPdfDataUrlCharacters;
    if (value.length > maxCharacters) fail();
    const comma = value.indexOf(',');
    const mime = (kind === 'image' ? IMAGE_MIMES : ['application/pdf'])
        .find((type) => value.slice(0, comma) === `data:${type};base64`);
    if (!mime) fail();
    const encoded = value.slice(comma + 1);
    if (!encoded.length || encoded.length % 4 !== 0) fail();
    const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
    const end = encoded.length - padding;
    if (/[^A-Za-z0-9+/]/.test(encoded.slice(0, end))) fail();
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const last = alphabet.indexOf(encoded[end - 1]);
    if (last < 0 || (padding === 2 && (last & 15) !== 0) || (padding === 1 && (last & 3) !== 0)) fail();
    const bytes = encoded.length / 4 * 3 - padding;
    if (bytes > maxBytes || (declaredBytes !== undefined && (!Number.isSafeInteger(declaredBytes) || declaredBytes <= 0 || bytes !== declaredBytes))) fail();
    const header = Uint8Array.from(atob(encoded.slice(0, 24)), (char) => char.charCodeAt(0));
    if (!signatureMatches(mime, header)) fail('Attachment MIME does not match its file signature.');
    return bytes;
}

function attachmentMetrics(attachments: readonly BoundedAiAttachment[]) {
    if (attachments.length > AI_ATTACHMENT_BOUNDS.maxAttachments) fail('At most 4 attachments can be sent at once.');
    let bytes = 0;
    let textCharacters = 0;
    let serializedBytes = 2;
    for (const attachment of attachments) {
        if (!attachment || !['image', 'sql', 'table', 'file'].includes(attachment.type) ||
            typeof attachment.label !== 'string' || attachment.label.length > 255 || typeof attachment.data !== 'string' ||
            (attachment.preview !== undefined && (typeof attachment.preview !== 'string' ||
                (attachment.type !== 'image' && attachment.preview.length > 500)))) fail();
        if (attachment.type === 'image') {
            if (attachment.rawData || attachment.mimeType) fail();
            bytes += assertAiBinaryDataUrl(attachment.data, 'image');
            if (attachment.preview !== undefined && attachment.preview !== attachment.data) fail();
        } else {
            if (attachment.data.length > AI_ATTACHMENT_BOUNDS.maxAttachmentCharacters) fail('Attachment text exceeds its character limit.');
            textCharacters += attachment.data.length;
            bytes += new TextEncoder().encode(attachment.data).length;
            if (attachment.rawData !== undefined) {
                if (attachment.mimeType !== 'application/pdf') fail();
                bytes += assertAiBinaryDataUrl(attachment.rawData, 'pdf');
            }
            if (attachment.mimeType !== undefined && attachment.mimeType !== 'application/pdf') fail();
        }
        // Each field has been bounded before serialization; count duplicate image previews too.
        serializedBytes += new TextEncoder().encode(JSON.stringify(attachment)).length + 1;
        if (bytes > AI_ATTACHMENT_BOUNDS.maxAggregateBytes || textCharacters > AI_ATTACHMENT_BOUNDS.maxAggregateTextCharacters ||
            serializedBytes > AI_ATTACHMENT_BOUNDS.maxSerializedBytes) fail('Combined attachments exceed the aggregate limit.');
    }
    return { bytes, textCharacters, serializedBytes };
}

export function assertAiAttachmentBounds(attachments: readonly BoundedAiAttachment[]): void {
    attachmentMetrics(attachments);
}

/** Conservative aggregate reservation BEFORE a full read or PDF worker import. */
export function assertAiAttachmentPreflight(file: AiFileDeclaration, attachments: readonly BoundedAiAttachment[]): AiFileKind {
    const kind = assertAiFileDeclaration(file);
    const current = attachmentMetrics(attachments);
    if (attachments.length >= AI_ATTACHMENT_BOUNDS.maxAttachments) fail('At most 4 attachments can be sent at once.');
    const textBytes = kind === 'pdf' ? AI_ATTACHMENT_BOUNDS.maxAttachmentCharacters * 3 : kind === 'text' ? file.size + 1024 : 0;
    const rawBytes = kind === 'text' ? 0 : file.size;
    const serialized = kind === 'image' ? 2 * (4 * Math.ceil(file.size / 3) + 32) :
        kind === 'pdf' ? 4 * Math.ceil(file.size / 3) + textBytes * 2 : textBytes * 6;
    if (current.bytes + rawBytes + textBytes > AI_ATTACHMENT_BOUNDS.maxAggregateBytes ||
        current.serializedBytes + serialized + 2048 > AI_ATTACHMENT_BOUNDS.maxSerializedBytes ||
        (kind !== 'image' && current.textCharacters + AI_ATTACHMENT_BOUNDS.maxAttachmentCharacters > AI_ATTACHMENT_BOUNDS.maxAggregateTextCharacters)) {
        fail('Combined attachments exceed the aggregate limit.');
    }
    return kind;
}

export function assertAiTextFileContent(content: string, declaredBytes: number): void {
    if (typeof content !== 'string' || content.includes('\0') || new TextEncoder().encode(content).length !== declaredBytes) fail('Attachment text is invalid or its size declaration does not match.');
}

export function boundAiExtractedText(content: string): string {
    return content.length > AI_ATTACHMENT_BOUNDS.maxExtractedCharacters
        ? content.slice(0, AI_ATTACHMENT_BOUNDS.maxExtractedCharacters) + '\n\n[... truncated at 50,000 chars]'
        : content;
}

export function warnAiBinaryOmitted<T extends { preview?: string }>(attachment: T): T {
    if (attachment.preview?.includes(AI_BINARY_REATTACH_WARNING)) return attachment;
    return { ...attachment, preview: `${attachment.preview ? `${attachment.preview}. ` : ''}${AI_BINARY_REATTACH_WARNING}` };
}
