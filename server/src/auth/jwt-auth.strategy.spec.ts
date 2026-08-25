import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt-auth.strategy';

describe('JwtStrategy', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = '0123456789abcdef0123456789abcdef';
  });

  it('rejects non-access JWT payloads', async () => {
    const strategy = new JwtStrategy();
    await expect(
      strategy.validate({
        sub: 'user-1',
        email: 'user@example.com',
        role: 'user',
        type: 'oauth-exchange',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
