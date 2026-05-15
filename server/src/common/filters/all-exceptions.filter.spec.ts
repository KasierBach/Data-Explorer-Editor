import { UnauthorizedException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  it('preserves auth metadata from structured exception responses', () => {
    const filter = new AllExceptionsFilter();
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({
          headersSent: false,
          status,
        }),
        getRequest: () => ({
          url: '/api/auth/login',
        }),
      }),
    } as any;

    filter.catch(
      new UnauthorizedException({
        message: 'Please verify email',
        unverified: true,
        email: 'ada@example.com',
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Please verify email',
        unverified: true,
        email: 'ada@example.com',
      }),
    );
  });
});
