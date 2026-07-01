import { validate } from 'class-validator';
import { CreateQueryDto } from './create-query.dto';

describe('CreateQueryDto', () => {
  it('rejects raw query limits above the server safety cap', async () => {
    const dto = Object.assign(new CreateQueryDto(), {
      connectionId: 'd44d17df-dffa-45b1-9d67-151857ca2b3f',
      sql: 'SELECT * FROM users',
      limit: 50_001,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'limit')).toBe(true);
  });
});
