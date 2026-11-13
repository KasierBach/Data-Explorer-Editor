import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import {
    AI_ATTACHMENT_BOUNDS, AI_BINARY_REATTACH_WARNING, AI_WORKBOOK_REFUSAL,
    assertAiAttachmentBounds, assertAiAttachmentPreflight, assertAiBinaryDataUrl,
    assertAiFileDeclaration, assertAiFileSignature, assertAiTextFileContent,
    boundAiExtractedText, warnAiBinaryOmitted,
} from './aiAttachmentBounds';

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const pdf = Buffer.from('%PDF-1.7\n');
const url = (mime: string, bytes: Uint8Array) => `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
const buffer = (bytes: Uint8Array) => Uint8Array.from(bytes).buffer;
const textAttachment = { type: 'file', label: 'fixture.txt', data: 'fixture' };

describe('AI attachment bounds (synthetic signatures, not decoder quality)', () => {
    it('accepts an empty set and valid current image/PDF/text declarations', () => {
        expect(() => assertAiAttachmentBounds([])).not.toThrow();
        expect(assertAiFileDeclaration({ name: 'fixture.png', type: 'image/png', size: png.length })).toBe('image');
        expect(assertAiFileDeclaration({ name: 'fixture.pdf', type: 'application/pdf', size: pdf.length })).toBe('pdf');
        expect(assertAiFileDeclaration({ name: 'fixture.csv', type: 'text/csv', size: 12 })).toBe('text');
        expect(() => assertAiFileSignature({ name: 'fixture.png', type: 'image/png', size: png.length }, 'image', buffer(png))).not.toThrow();
    });

    it.each([
        ['fixture.png', 'image/png', AI_ATTACHMENT_BOUNDS.maxImageBytes + 1],
        ['fixture.pdf', 'application/pdf', AI_ATTACHMENT_BOUNDS.maxPdfBytes + 1],
        ['fixture.txt', 'text/plain', AI_ATTACHMENT_BOUNDS.maxTextBytes + 1],
        ['fixture.txt', 'text/plain', 0], ['fixture.txt', 'text/plain', Infinity],
        ['fixture.txt', 'text/plain', -1], ['fixture.txt', 'text/plain', 1.5],
        ['fixture.png', 'image/svg+xml', 12], ['fixture.pdf', 'text/plain', 12],
        ['fixture.exe', 'application/octet-stream', 12], ['fixture.txt', 'unknown/custom', 12],
    ])('refuses unsafe declarations before reads', (name, type, size) => {
        expect(() => assertAiFileDeclaration({ name, type, size })).toThrow();
    });

    it.each(['xlsx', 'ods', 'xls'])('refuses %s before parsing with a CSV/TSV alternative', (ext) => {
        expect(() => assertAiFileDeclaration({ name: `fixture.${ext}`, type: '', size: 16 })).toThrow(AI_WORKBOOK_REFUSAL);
    });

    it('rejects MIME/signature spoofing and a short declared header', () => {
        expect(() => assertAiFileSignature({ name: 'fixture.jpg', type: 'image/jpeg', size: png.length }, 'image', buffer(png))).toThrow();
        expect(() => assertAiFileSignature({ name: 'fixture.pdf', type: 'application/pdf', size: 30 }, 'pdf', buffer(pdf))).toThrow();
        expect(() => assertAiFileSignature({ name: 'fixture.txt', type: 'text/plain', size: png.length }, 'text', buffer(png))).toThrow();
        expect(() => assertAiFileSignature({ name: 'fixture.csv', type: 'text/csv', size: 4 }, 'text', buffer(Buffer.from('PK\x03\x04')))).toThrow();
    });

    it.each([
        ['image/png', png], ['image/jpeg', Buffer.from([255, 216, 255])],
        ['image/gif', Buffer.from('GIF87a')], ['image/webp', Buffer.from('RIFF0000WEBP')],
    ])('accepts canonical %s base64/header fixtures', (mime, bytes) => {
        expect(assertAiBinaryDataUrl(url(mime, bytes), 'image', bytes.length)).toBe(bytes.length);
    });

    it.each([
        'data:image/png;base64,', 'data:image/png;base64,AA=A',
        'data:image/png;base64,AB==', 'data:image/png;base64,iVBORw0KGgo===',
        'data:image/jpeg;base64,iVBORw0KGgo=', 'data:image/png;base64,aGVsbG8=',
    ])('rejects corrupt base64, padding and MIME', (data) => {
        expect(() => assertAiBinaryDataUrl(data, 'image')).toThrow();
    });

    it('checks decoded size, declaration and PDF current cap', () => {
        expect(assertAiBinaryDataUrl(url('application/pdf', pdf), 'pdf', pdf.length)).toBe(pdf.length);
        expect(() => assertAiBinaryDataUrl(url('application/pdf', pdf), 'pdf', pdf.length - 1)).toThrow();
        const bytes = Buffer.alloc(AI_ATTACHMENT_BOUNDS.maxImageBytes + 1);
        png.copy(bytes);
        expect(() => assertAiBinaryDataUrl(url('image/png', bytes), 'image')).toThrow();
        expect(AI_ATTACHMENT_BOUNDS.maxPdfBytes).toBe(5 * 1024 * 1024);
        expect(AI_ATTACHMENT_BOUNDS.maxPdfDataUrlCharacters).toBe(7_000_000);
    });

    it('enforces count, aggregate reservations and text characters before full reads', () => {
        expect(() => assertAiAttachmentBounds(Array(5).fill(textAttachment))).toThrow(/4 attachments/);
        expect(() => assertAiAttachmentPreflight({ name: 'fixture.txt', type: 'text/plain', size: 12 }, Array(4).fill(textAttachment))).toThrow(/4 attachments/);
        expect(() => assertAiAttachmentBounds(Array(4).fill({ ...textAttachment, data: 'a'.repeat(60_000) }))).toThrow(/aggregate/);
        expect(() => assertAiAttachmentBounds([{ ...textAttachment, data: 'a'.repeat(60_001) }])).toThrow(/character/);
        const image = Buffer.alloc(AI_ATTACHMENT_BOUNDS.maxImageBytes);
        png.copy(image);
        expect(() => assertAiAttachmentPreflight({ name: 'fixture.pdf', type: 'application/pdf', size: AI_ATTACHMENT_BOUNDS.maxPdfBytes }, [
            { type: 'image', label: 'fixture.png', data: url('image/png', image) },
        ])).toThrow(/aggregate/);
    });

    it('checks full text byte declarations and bounds extracted characters', () => {
        expect(() => assertAiTextFileContent('hello', 5)).not.toThrow();
        expect(() => assertAiTextFileContent('hello', 6)).toThrow();
        expect(() => assertAiTextFileContent('hello\0', 6)).toThrow();
        expect(boundAiExtractedText('')).toBe('');
        const bounded = boundAiExtractedText('a'.repeat(80_000));
        expect(bounded).toContain('truncated at 50,000 chars');
        expect(bounded.length).toBeLessThan(60_000);
    });

    it('warns about binary omission without duplicating the warning', () => {
        const warned = warnAiBinaryOmitted({ preview: 'PDF - 1 KB' });
        expect(warned.preview).toContain(AI_BINARY_REATTACH_WARNING);
        expect(warnAiBinaryOmitted(warned)).toEqual(warned);
    });
});
