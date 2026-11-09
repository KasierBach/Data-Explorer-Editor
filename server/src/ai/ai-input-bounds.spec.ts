import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import {
  AI_INPUT_BOUNDS,
  assertAiBinaryDataUrl,
  assertAiInputBounds,
  assertAiSerializedInputBounds,
} from './ai-input-bounds';

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const pdf = Buffer.from('%PDF-1.7\n');
const url = (mime: string, data: Buffer) =>
  `data:${mime};base64,${data.toString('base64')}`;
const input = (extra: Record<string, unknown> = {}) => ({
  connectionId: 'fixture',
  prompt: 'Read the attachment',
  ...extra,
});

// Header-only synthetic fixtures intentionally do not claim full decoder validity.
describe('AI input bounds', () => {
  it.each([
    ['image/png', png],
    ['image/jpeg', Buffer.from([255, 216, 255, 224])],
    ['image/gif', Buffer.from('GIF89a')],
    ['image/webp', Buffer.from('RIFF0000WEBP')],
  ])('accepts canonical %s header fixtures', (mime, data) => {
    expect(
      assertAiBinaryDataUrl(url(mime, data), 'image', data.length),
    ).toEqual({ mimeType: mime, decodedBytes: data.length });
  });

  it('accepts an empty attachment set and real PDF signature with optional declared size', () => {
    expect(() => assertAiInputBounds(input({ history: [] }))).not.toThrow();
    expect(() =>
      assertAiInputBounds(
        input({
          document: {
            name: 'fixture.pdf',
            mimeType: 'application/pdf',
            data: url('application/pdf', pdf),
            size: pdf.length,
          },
        }),
      ),
    ).not.toThrow();
  });

  it.each([
    'data:image/png;base64,',
    'data:image/png;base64,AA=A',
    'data:image/png;base64,AAAA===',
    'data:image/png;base64,AAAA\nAAA=',
    'data:image/png;base64,AB==',
    'data:image/svg+xml;base64,PHN2Zz4=',
    'data:image/jpeg;base64,iVBORw0KGgo=',
    'https://example.test/image.png',
  ])('rejects malformed syntax, unknown MIME and spoofed headers', (data) => {
    expect(() => assertAiBinaryDataUrl(data, 'image')).toThrow(
      BadRequestException,
    );
  });

  it('rejects fake PDF content and invalid declared byte counts', () => {
    expect(() =>
      assertAiBinaryDataUrl(
        url('application/pdf', Buffer.from('hello')),
        'pdf',
      ),
    ).toThrow(BadRequestException);
    for (const size of [0, -1, NaN, Infinity, '9', pdf.length + 1]) {
      expect(() =>
        assertAiBinaryDataUrl(url('application/pdf', pdf), 'pdf', size),
      ).toThrow(BadRequestException);
    }
  });

  it.each(['image', 'pdf'] as const)(
    'enforces the exact decoded %s ceiling before a full decode',
    (kind) => {
      const bytes =
        kind === 'image'
          ? AI_INPUT_BOUNDS.maxImageBytes
          : AI_INPUT_BOUNDS.maxPdfBytes;
      const mime = kind === 'image' ? 'image/png' : 'application/pdf';
      const data = Buffer.alloc(bytes);
      (kind === 'image' ? png : pdf).copy(data);
      expect(assertAiBinaryDataUrl(url(mime, data), kind).decodedBytes).toBe(
        bytes,
      );
      const oversized = Buffer.concat([data, Buffer.from([0])]);
      expect(() => assertAiBinaryDataUrl(url(mime, oversized), kind)).toThrow(
        PayloadTooLargeException,
      );
    },
  );

  it('preserves PDF URL and body parser constants instead of increasing them', () => {
    expect(AI_INPUT_BOUNDS.maxPdfDataUrlCharacters).toBe(7_000_000);
    expect(AI_INPUT_BOUNDS.maxPdfBytes).toBe(5 * 1024 * 1024);
    expect(AI_INPUT_BOUNDS.maxSerializedBytes).toBe(10 * 1024 * 1024);
  });

  it('bounds the aggregate serialized envelope, including JSON escapes and UTF-8', () => {
    const limit = AI_INPUT_BOUNDS.maxSerializedBytes;
    expect(() =>
      assertAiSerializedInputBounds('a'.repeat(limit - 2)),
    ).not.toThrow();
    expect(() => assertAiSerializedInputBounds('a'.repeat(limit - 1))).toThrow(
      PayloadTooLargeException,
    );
    expect(() =>
      assertAiInputBounds(
        input({
          prompt: 'a'.repeat(limit / 2),
          context: 'b'.repeat(limit / 2),
        }),
      ),
    ).toThrow(PayloadTooLargeException);
    expect(() =>
      assertAiSerializedInputBounds('\0'.repeat(Math.ceil(limit / 6))),
    ).toThrow(PayloadTooLargeException);
    expect(() =>
      assertAiSerializedInputBounds('界'.repeat(Math.ceil(limit / 3))),
    ).toThrow(PayloadTooLargeException);
    expect(() =>
      assertAiSerializedInputBounds({
        prompt: '\ud800'.repeat(Math.ceil(limit / 6)),
      }),
    ).toThrow(PayloadTooLargeException);
  });

  it.each([
    null,
    [],
    {},
    input({ prompt: 42 }),
    input({ context: {} }),
    input({ history: {} }),
    input({ history: [{ role: 'assistant', content: 'fixture' }] }),
    input({ history: [{ role: 'user', content: [] }] }),
    input({ image: {} }),
    input({ document: [] }),
    input({ disabledProviders: ['fixture', {}] }),
    input({ providerOverride: { model: [] } }),
  ])('rejects malformed trusted input types', (body) => {
    expect(() => assertAiInputBounds(body)).toThrow(BadRequestException);
  });

  it('keeps existing prompt/history/context strings valid within the aggregate envelope', () => {
    expect(() =>
      assertAiInputBounds(
        input({
          prompt: 'a'.repeat(120_000),
          context: 'b'.repeat(200_000),
          history: [{ role: 'ai', content: 'c'.repeat(120_000) }],
        }),
      ),
    ).not.toThrow();
  });

  it('rejects non-JSON, cyclic and excessive nested inputs without serializing them', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => assertAiSerializedInputBounds(cyclic)).toThrow(
      BadRequestException,
    );
    expect(() => assertAiSerializedInputBounds({ value: Infinity })).toThrow(
      BadRequestException,
    );
    let nested: unknown = 'fixture';
    for (let depth = 0; depth < 35; depth++) nested = { nested };
    expect(() => assertAiSerializedInputBounds(nested)).toThrow(
      PayloadTooLargeException,
    );
  });
});
