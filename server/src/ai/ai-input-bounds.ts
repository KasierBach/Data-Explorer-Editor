import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import {
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator';

const MIB = 1024 * 1024;

// Keep the existing 5 MiB native PDF / 7,000,000-character DTO limit and
// the 10 MiB JSON parser ceiling. These are input bounds, not decoder safety.
export const AI_INPUT_BOUNDS = Object.freeze({
  maxImageBytes: 2 * MIB,
  maxPdfBytes: 5 * MIB,
  maxPdfDataUrlCharacters: 7_000_000,
  maxImageDataUrlCharacters: 4 * Math.ceil((2 * MIB) / 3) + 32,
  maxSerializedBytes: 10 * MIB,
  maxJsonDepth: 32,
  maxJsonValues: 20_000,
});

export type AiBinaryKind = 'image' | 'pdf';

function invalid(field: string): never {
  throw new BadRequestException(`Invalid AI input: ${field}.`);
}

function tooLarge(field: string): never {
  throw new PayloadTooLargeException(`AI input exceeds the ${field} limit.`);
}

/** Counts the JSON/UTF-8 envelope without first allocating a serialized copy. */
export function assertAiSerializedInputBounds(input: unknown): void {
  let bytes = 0;
  let values = 0;
  const ancestors = new Set<object>();
  const add = (amount: number) => {
    bytes += amount;
    if (bytes > AI_INPUT_BOUNDS.maxSerializedBytes) tooLarge('10 MiB request');
  };
  const string = (value: string) => {
    add(2);
    for (let index = 0; index < value.length; index++) {
      const code = value.charCodeAt(index);
      if (code === 34 || code === 92) add(2);
      else if (code < 32) add([8, 9, 10, 12, 13].includes(code) ? 2 : 6);
      else if (code < 128) add(1);
      else if (code < 2048) add(2);
      else if (code >= 0xd800 && code <= 0xdbff) {
        const next = value.charCodeAt(index + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          add(4);
          index++;
        } else add(6);
      } else if (code >= 0xdc00 && code <= 0xdfff) add(6);
      else add(3);
    }
  };
  const visit = (value: unknown, depth: number) => {
    if (++values > AI_INPUT_BOUNDS.maxJsonValues) tooLarge('JSON value count');
    if (depth > AI_INPUT_BOUNDS.maxJsonDepth) tooLarge('JSON nesting');
    if (value === null) {
      add(4);
      return;
    }
    if (typeof value === 'string') {
      string(value);
      return;
    }
    if (typeof value === 'boolean') {
      add(value ? 4 : 5);
      return;
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) invalid('non-finite number');
      add(String(value).length);
      return;
    }
    if (!value || typeof value !== 'object') invalid('non-JSON value');
    if (ancestors.has(value)) invalid('cyclic envelope');
    ancestors.add(value);
    add(2);
    if (Array.isArray(value)) {
      if (value.length > AI_INPUT_BOUNDS.maxJsonValues)
        tooLarge('JSON value count');
      for (let index = 0; index < value.length; index++) {
        if (index) add(1);
        visit(value[index] === undefined ? null : value[index], depth + 1);
      }
    } else {
      let count = 0;
      for (const key of Object.keys(value)) {
        const child = (value as Record<string, unknown>)[key];
        if (child === undefined) continue;
        if (count++) add(1);
        string(key);
        add(1);
        visit(child, depth + 1);
      }
    }
    ancestors.delete(value);
  };
  visit(input, 0);
}

function hasMagicHeader(mime: string, header: Uint8Array): boolean {
  const starts = (...bytes: number[]) =>
    bytes.every((byte, index) => header[index] === byte);
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...header.subarray(start, end));
  switch (mime) {
    case 'image/png':
      return starts(137, 80, 78, 71, 13, 10, 26, 10);
    case 'image/jpeg':
      return starts(255, 216, 255);
    case 'image/gif':
      return ['GIF87a', 'GIF89a'].includes(ascii(0, 6));
    case 'image/webp':
      return (
        header.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP'
      );
    case 'application/pdf':
      return /^%PDF-(?:1\.[0-9]|2\.0)/.test(ascii(0, 8));
    default:
      return false;
  }
}

/** Checks canonical base64 and a small decoded header; never decodes the whole blob. */
export function assertAiBinaryDataUrl(
  value: unknown,
  kind: AiBinaryKind,
  declaredBytes?: unknown,
): { mimeType: string; decodedBytes: number } {
  if (typeof value !== 'string') invalid(`${kind} data URL type`);
  const maxCharacters =
    kind === 'image'
      ? AI_INPUT_BOUNDS.maxImageDataUrlCharacters
      : AI_INPUT_BOUNDS.maxPdfDataUrlCharacters;
  if (value.length > maxCharacters) tooLarge(`${kind} data URL`);
  const comma = value.indexOf(',');
  const prefix = comma >= 0 ? value.slice(0, comma) : '';
  const allowed =
    kind === 'image'
      ? ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
      : ['application/pdf'];
  const mimeType = allowed.find((mime) => prefix === `data:${mime};base64`);
  if (!mimeType) invalid(`${kind} MIME/data URL`);
  const encoded = value.slice(comma + 1);
  if (!encoded.length || encoded.length % 4 !== 0)
    invalid(`${kind} base64 length`);
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  const contentEnd = encoded.length - padding;
  if (/[^A-Za-z0-9+/]/.test(encoded.slice(0, contentEnd)))
    invalid(`${kind} base64 syntax`);
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const last = alphabet.indexOf(encoded[contentEnd - 1]);
  if (
    last < 0 ||
    (padding === 2 && (last & 15) !== 0) ||
    (padding === 1 && (last & 3) !== 0)
  ) {
    invalid(`${kind} base64 padding`);
  }
  const decodedBytes = (encoded.length / 4) * 3 - padding;
  const maxBytes =
    kind === 'image'
      ? AI_INPUT_BOUNDS.maxImageBytes
      : AI_INPUT_BOUNDS.maxPdfBytes;
  if (decodedBytes > maxBytes) tooLarge(`${kind} decoded bytes`);
  if (
    declaredBytes !== undefined &&
    (!Number.isSafeInteger(declaredBytes) ||
      (declaredBytes as number) <= 0 ||
      declaredBytes !== decodedBytes)
  )
    invalid(`${kind} declared size`);
  const header = Buffer.from(encoded.slice(0, 24), 'base64').subarray(0, 16);
  if (!hasMagicHeader(mimeType, header)) invalid(`${kind} signature`);
  return { mimeType, decodedBytes };
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    invalid(`${field} type`);
  return value as Record<string, unknown>;
}

/** Call on the DTO/body before schema gathering or any provider-bound work. */
export function assertAiInputBounds(body: unknown): void {
  const input = record(body, 'body');
  assertAiSerializedInputBounds(input);
  for (const field of ['connectionId', 'prompt']) {
    if (typeof input[field] !== 'string' || !input[field].length)
      invalid(`${field} type/content`);
  }
  for (const field of [
    'database',
    'context',
    'model',
    'mode',
    'routingMode',
    'fallbackProvider',
  ]) {
    if (input[field] != null && typeof input[field] !== 'string')
      invalid(`${field} type`);
  }
  if (input.image != null) assertAiBinaryDataUrl(input.image, 'image');
  if (input.document != null) {
    const document = record(input.document, 'document');
    if (
      typeof document.name !== 'string' ||
      !document.name.length ||
      document.name.length > 255
    )
      invalid('document name');
    if (document.mimeType !== 'application/pdf') invalid('document MIME');
    assertAiBinaryDataUrl(document.data, 'pdf', document.size);
  }
  if (input.history != null) {
    if (!Array.isArray(input.history)) invalid('history type');
    for (const value of input.history) {
      const message = record(value, 'history message');
      if (!['user', 'ai'].includes(message.role as string))
        invalid('history role');
      if (typeof message.content !== 'string' || !message.content.length)
        invalid('history content');
    }
  }
  if (
    input.disabledProviders != null &&
    (!Array.isArray(input.disabledProviders) ||
      input.disabledProviders.some((value) => typeof value !== 'string'))
  )
    invalid('disabledProviders type');
  if (input.providerOverride != null) {
    const override = record(input.providerOverride, 'providerOverride');
    for (const field of [
      'type',
      'providerId',
      'name',
      'baseUrl',
      'apiKey',
      'model',
    ]) {
      if (override[field] != null && typeof override[field] !== 'string')
        invalid(`providerOverride.${field} type`);
    }
    if (override.capabilities != null)
      record(override.capabilities, 'providerOverride capabilities');
  }
}

@ValidatorConstraint({ name: 'aiInputBounds', async: false })
export class AiInputBoundsConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    try {
      assertAiInputBounds(args.object);
      return true;
    } catch {
      return false;
    }
  }
  defaultMessage(): string {
    return 'AI input has invalid attachments, types or exceeds the aggregate request limit';
  }
}

@ValidatorConstraint({ name: 'aiImageBounds', async: false })
export class AiImageBoundsConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    try {
      assertAiBinaryDataUrl(value, 'image');
      return true;
    } catch {
      return false;
    }
  }
  defaultMessage(): string {
    return 'image must contain valid PNG/JPEG/GIF/WebP base64 and fit within 2 MiB decoded';
  }
}

@ValidatorConstraint({ name: 'aiPdfBounds', async: false })
export class AiPdfBoundsConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    try {
      assertAiBinaryDataUrl(
        value,
        'pdf',
        (args.object as { size?: unknown }).size,
      );
      return true;
    } catch {
      return false;
    }
  }
  defaultMessage(): string {
    return 'document must contain valid PDF base64, matching size and fit the existing PDF limit';
  }
}
