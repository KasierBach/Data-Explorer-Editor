import { validate } from 'class-validator';
import { CreateDashboardDto } from './create-dashboard.dto';

describe('CreateDashboardDto', () => {
  it('rejects legacy team visibility to avoid domain-based sharing', async () => {
    const dto = Object.assign(new CreateDashboardDto(), {
      name: 'Revenue',
      visibility: 'team',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'visibility')).toBe(true);
  });
});
