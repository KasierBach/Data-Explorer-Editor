import { validate } from 'class-validator';
import { UpdateProfileDto } from './update-profile.dto';

describe('UpdateProfileDto', () => {
  it('rejects avatar payloads above the persisted size ceiling', async () => {
    const dto = new UpdateProfileDto();
    dto.avatarUrl = 'a'.repeat(750_001);

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'avatarUrl')).toBe(true);
  });
});
