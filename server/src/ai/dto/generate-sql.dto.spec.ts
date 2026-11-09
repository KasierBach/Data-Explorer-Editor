import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GenerateSqlDto } from './generate-sql.dto';

describe('GenerateSqlDto', () => {
  it('rejects unsupported routing modes and invalid history roles', async () => {
    const dto = plainToInstance(GenerateSqlDto, {
      connectionId: 'conn-1',
      prompt: 'show me the latest orders',
      mode: 'turbo',
      routingMode: 'balanced',
      history: [{ role: 'assistant', content: 'hello' }],
    });

    const errors = await validate(dto);
    const constraints = JSON.stringify(errors);

    expect(constraints).toContain('routingMode');
    expect(constraints).toContain('mode');
    expect(constraints).toContain('history');
  });

  it('accepts supported modes and typed chat history', async () => {
    const dto = plainToInstance(GenerateSqlDto, {
      connectionId: 'conn-1',
      prompt: 'show me customers',
      mode: 'planning',
      routingMode: 'best',
      history: [
        { role: 'user', content: 'find active customers' },
        { role: 'ai', content: 'Here is a draft query.' },
      ],
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
  it.each([
    { image: 'data:image/png;base64,aGVsbG8=' },
    { image: 'data:image/png;base64,iVBORw0KGgo===' },
    { image: 'data:image/svg+xml;base64,PHN2Zz4=' },
    {
      document: {
        name: 'fixture.pdf',
        mimeType: 'application/pdf',
        data: 'data:application/pdf;base64,JVBERi0xLjcK',
        size: 1,
      },
    },
    {
      prompt: 'a'.repeat(6 * 1024 * 1024),
      context: 'b'.repeat(5 * 1024 * 1024),
    },
  ])(
    'rejects invalid attachment content/declarations and aggregate payloads',
    async (extra) => {
      const dto = plainToInstance(GenerateSqlDto, {
        connectionId: 'fixture',
        prompt: 'Read fixture',
        ...extra,
      });
      expect((await validate(dto)).length).toBeGreaterThan(0);
    },
  );

  it('accepts a canonical PNG header fixture without changing existing string fields', async () => {
    const dto = plainToInstance(GenerateSqlDto, {
      connectionId: 'fixture',
      prompt: 'Read fixture',
      context: 'Context',
      image: 'data:image/png;base64,iVBORw0KGgo=',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts PDF data URLs and rejects other document payloads', async () => {
    const valid = plainToInstance(GenerateSqlDto, {
      connectionId: 'conn-1',
      prompt: 'Read this PDF',
      document: {
        name: 'schema.pdf',
        mimeType: 'application/pdf',
        data: 'data:application/pdf;base64,JVBERi0xLjcK',
      },
    });
    const invalid = plainToInstance(GenerateSqlDto, {
      connectionId: 'conn-1',
      prompt: 'Read this file',
      document: {
        name: 'schema.html',
        mimeType: 'text/html',
        data: 'data:text/html;base64,aGVsbG8=',
      },
    });

    expect(await validate(valid)).toHaveLength(0);
    expect(
      (await validate(invalid)).some((error) => error.property === 'document'),
    ).toBe(true);
  });
});
