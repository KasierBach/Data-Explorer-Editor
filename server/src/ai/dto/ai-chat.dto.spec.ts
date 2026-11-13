import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AddMessageDto, EditMessageAndTruncateDto } from './ai-chat.dto';

const BASE = { role: 'user', content: 'hello' };
const UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('AddMessageDto', () => {
  it('rejects roles outside the supported AI chat contract', async () => {
    const errors = await validate(
      plainToInstance(AddMessageDto, { ...BASE, role: 'assistant' }),
    );
    expect(errors.map((error) => error.property)).toContain('role');
  });

  it.each(['user', 'ai'])(
    'accepts %s role and legacy bodies without ids or versions',
    async (role) => {
      await expect(
        validate(plainToInstance(AddMessageDto, { ...BASE, role })),
      ).resolves.toHaveLength(0);
    },
  );

  it('accepts optional stable UUID and timezone-qualified chat version', async () => {
    const dto = plainToInstance(AddMessageDto, {
      ...BASE,
      clientMessageId: UUID,
      expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
    });
    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.clientMessageId).toBe(UUID);
  });

  it.each(['pending-1', '', 123, 'not-a-uuid'])(
    'rejects invalid stable id %s',
    async (clientMessageId) => {
      const errors = await validate(
        plainToInstance(AddMessageDto, { ...BASE, clientMessageId }),
      );
      expect(errors.map((error) => error.property)).toContain(
        'clientMessageId',
      );
    },
  );

  it.each([
    'not-a-date',
    '2026-02-30T00:00:00.000Z',
    '2026-01-01',
    '2026-01-01T00:00:00',
    123,
  ])(
    'rejects invalid or timezone-ambiguous version %s',
    async (expectedUpdatedAt) => {
      const errors = await validate(
        plainToInstance(AddMessageDto, { ...BASE, expectedUpdatedAt }),
      );
      expect(errors.map((error) => error.property)).toContain(
        'expectedUpdatedAt',
      );
    },
  );

  it.each(['userId', 'actorId', 'user', 'actor'])(
    'rejects body actor field %s with whitelist enabled',
    async (field) => {
      const errors = await validate(
        plainToInstance(AddMessageDto, { ...BASE, [field]: 'spoofed-actor' }),
        { whitelist: true },
      );
      expect(errors.map((error) => error.property)).toContain(field);
    },
  );

  it('retains optional existing A02 provenance and legacy attachment payloads', async () => {
    for (const attachments of [
      [{ type: 'image', label: 'image.png' }],
      {
        contractVersion: 1,
        generationId: 'g-1',
        sources: ['https://example.com'],
        usage: { totalTokens: 42 },
        warnings: ['fallback'],
        items: [],
        modelInfo: { provider: 'gemini' },
      },
    ]) {
      const dto = plainToInstance(AddMessageDto, { ...BASE, attachments });
      await expect(validate(dto, { whitelist: true })).resolves.toHaveLength(0);
      expect(dto.attachments).toEqual(attachments);
    }
  });
});

describe('EditMessageAndTruncateDto', () => {
  it('inherits role/content and optional chat concurrency metadata', async () => {
    await expect(
      validate(
        plainToInstance(EditMessageAndTruncateDto, {
          ...BASE,
          expectedUpdatedAt: '2026-01-01T00:00:00.000+00:00',
        }),
      ),
    ).resolves.toHaveLength(0);
  });

  it('refuses actor spoofing on the additive edit contract', async () => {
    const errors = await validate(
      plainToInstance(EditMessageAndTruncateDto, { ...BASE, userId: 'other' }),
    );
    expect(errors.map((error) => error.property)).toContain('userId');
  });
});
