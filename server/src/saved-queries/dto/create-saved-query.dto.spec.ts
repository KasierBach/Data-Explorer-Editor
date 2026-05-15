import { validate } from 'class-validator';
import { CreateSavedQueryDto } from './create-saved-query.dto';

describe('CreateSavedQueryDto', () => {
  it('rejects legacy team visibility to avoid misleading sharing semantics', async () => {
    const dto = Object.assign(new CreateSavedQueryDto(), {
      name: 'Revenue',
      sql: 'select 1',
      visibility: 'team',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'visibility')).toBe(true);
  });
});
