import type { Response } from 'express';
import {
  getClearedRefreshTokenCookieOptions,
  REFRESH_TOKEN_COOKIE,
} from '../auth/auth-cookie.util';
import type { AuthenticatedRequest } from '../auth/auth-request.types';
import { UsersController } from './users.controller';

jest.mock('../utils/crypto.util', () => ({
  encryptAttribute: jest.fn(),
  decryptAttribute: jest.fn(),
}));

describe('UsersController account security', () => {
  const usersService = {
    changePassword: jest.fn(),
    resetPassword: jest.fn(),
    deleteAccount: jest.fn(),
  };
  const passwordDto = {
    currentPassword: 'old-password',
    newPassword: 'new-password',
  };
  const request = {
    user: { id: 'user-1' },
    headers: { 'accept-language': 'en-US,en;q=0.9' },
  } as unknown as AuthenticatedRequest;
  const cookie = jest.fn();
  const response = { cookie } as unknown as Response;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalFrontendUrl = process.env.FRONTEND_URL;
  let controller: UsersController;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.NODE_ENV = 'test';
    process.env.FRONTEND_URL = 'http://localhost:5173';
    controller = new UsersController(usersService as never);
    usersService.changePassword.mockResolvedValue({
      message: 'Password updated successfully',
    });
    usersService.resetPassword.mockResolvedValue({
      message: 'Password reset successfully',
    });
    usersService.deleteAccount.mockResolvedValue({
      message: 'Account deleted successfully',
    });
  });

  afterAll(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = originalFrontendUrl;
  });

  it.each([
    ['test', 'http://localhost:5173', false, 'lax'],
    ['production', 'http://localhost:5173', true, 'none'],
    ['test', 'https://app.example.com', true, 'none'],
  ])(
    'clears the self-change cookie using the existing %s cookie options',
    async (nodeEnv, frontendUrl, secure, sameSite) => {
      process.env.NODE_ENV = nodeEnv;
      process.env.FRONTEND_URL = frontendUrl;

      await expect(
        (controller as any).changePassword(request, passwordDto, response),
      ).resolves.toEqual({ message: 'Password updated successfully' });

      expect(usersService.changePassword).toHaveBeenCalledWith(
        'user-1',
        passwordDto,
      );
      expect(cookie).toHaveBeenCalledTimes(1);
      expect(cookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE,
        '',
        getClearedRefreshTokenCookieOptions(),
      );
      expect(cookie.mock.calls[0][2]).toEqual({
        httpOnly: true,
        secure,
        sameSite,
        path: '/',
        expires: new Date(0),
      });
    },
  );

  it('clears the self cookie only after the password mutation succeeds', async () => {
    let resolveChange!: (value: { message: string }) => void;
    usersService.changePassword.mockReturnValue(
      new Promise((resolve) => {
        resolveChange = resolve;
      }),
    );

    const pending = (controller as any).changePassword(
      request,
      passwordDto,
      response,
    );
    expect(cookie).not.toHaveBeenCalled();
    resolveChange({ message: 'Password updated successfully' });
    await pending;
    expect(cookie).toHaveBeenCalledTimes(1);
  });

  it('does not clear the self cookie after a failed password mutation', async () => {
    const failure = new Error('Current password does not match');
    usersService.changePassword.mockRejectedValue(failure);

    await expect(
      (controller as any).changePassword(request, passwordDto, response),
    ).rejects.toBe(failure);
    expect(cookie).not.toHaveBeenCalled();
  });

  it('never clears the admin cookie when resetting another user password', async () => {
    await expect(
      (controller as any).resetPassword(
        'other-user',
        { newPassword: 'new-password' },
        response,
      ),
    ).resolves.toEqual({ message: 'Password reset successfully' });

    expect(usersService.resetPassword).toHaveBeenCalledWith('other-user', {
      newPassword: 'new-password',
    });
    expect(cookie).not.toHaveBeenCalled();
  });

  it('passes the request locale for self-account deletion', async () => {
    await expect(controller.deleteAccount(request)).resolves.toEqual({
      message: 'Account deleted successfully',
    });
    expect(usersService.deleteAccount).toHaveBeenCalledWith('user-1', 'en');
  });

  it('passes the request locale for admin-account deletion without clearing cookies', async () => {
    const adminRequest = {
      user: { id: 'admin-1' },
      headers: { 'accept-language': ['vi-VN', 'en-US'] },
    } as unknown as AuthenticatedRequest;

    await expect(
      (controller as any).deleteUser('other-user', adminRequest),
    ).resolves.toEqual({ message: 'Account deleted successfully' });
    expect(usersService.deleteAccount).toHaveBeenCalledWith('other-user', 'vi');
    expect(cookie).not.toHaveBeenCalled();
  });
});
