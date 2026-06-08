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
});
