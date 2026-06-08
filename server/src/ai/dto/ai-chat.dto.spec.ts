import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AddMessageDto } from './ai-chat.dto';

describe('AddMessageDto', () => {
  it('rejects roles outside the supported AI chat contract', async () => {
    const dto = plainToInstance(AddMessageDto, {
      role: 'assistant',
      content: 'hello',
    });

    const errors = await validate(dto);
    const constraints = JSON.stringify(errors);

    expect(constraints).toContain('role');
  });

  it('accepts user and ai roles', async () => {
    const userDto = plainToInstance(AddMessageDto, {
      role: 'user',
      content: 'hello',
    });
    const aiDto = plainToInstance(AddMessageDto, {
      role: 'ai',
      content: 'world',
    });

    await expect(validate(userDto)).resolves.toHaveLength(0);
    await expect(validate(aiDto)).resolves.toHaveLength(0);
  });
});
