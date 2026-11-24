import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { UsersService } from './users.service';

const promiseBcrypt: {
  hash: (password: string, salt: number | string) => Promise<string>;
  compare: (password: string, hash: string) => Promise<boolean>;
} = bcrypt;
type BcryptCompareSpy = jest.SpyInstance<
  ReturnType<typeof promiseBcrypt.compare>,
  Parameters<typeof promiseBcrypt.compare>
>;

jest.mock('bcryptjs', () => {
  const actual = jest.requireActual('bcryptjs');
  return {
    __esModule: true,
    ...actual,
    hash: jest.fn(actual.hash),
    compare: jest.fn(actual.compare),
  };
});

describe('UsersService', () => {
  it('expires a stale Pro plan when the profile is loaded', async () => {
    const expiredUser = {
      id: 'user_1',
      plan: 'pro',
      planExpiresAt: new Date('2025-01-01T00:00:00.000Z'),
      subscriptionStatus: 'active',
    };
    const updatedUser = {
      ...expiredUser,
      plan: 'free',
      subscriptionStatus: 'expired',
    };
    const prisma = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(expiredUser)
          .mockResolvedValue(updatedUser),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      billingSubscription: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback(prisma),
      ),
    };
    const service = new UsersService(prisma as never);

    await expect(service.findById('user_1')).resolves.toEqual(updatedUser);
    expect(prisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'user_1',
          plan: 'pro',
          planExpiresAt: { lte: expect.any(Date) },
        },
        data: expect.objectContaining({
          plan: 'free',
          subscriptionStatus: 'expired',
        }),
      }),
    );
    expect(prisma.billingSubscription.updateMany).toHaveBeenCalled();
  });
});

describe('UsersService account security', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    aiGeneration: { deleteMany: jest.fn() },
    aiGenerationFeedback: { deleteMany: jest.fn() },
    aiProviderAttempt: { deleteMany: jest.fn() },
  };
  let service: UsersService;
  let compareSpy: BcryptCompareSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    compareSpy = jest.spyOn(promiseBcrypt, 'compare').mockResolvedValue(true);
    jest.spyOn(promiseBcrypt, 'hash').mockResolvedValue('new-password-hash');
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      password: 'old-password-hash',
      refreshTokenHash: 'old-refresh-hash',
      refreshTokenExpiry: new Date(Date.now() + 60_000),
    });
    prisma.user.update.mockResolvedValue({ id: 'user-1' });
    prisma.user.delete.mockResolvedValue({ id: 'user-1' });
    service = new UsersService(prisma as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('atomically clears the refresh session with a self-service password change', async () => {
    await expect(
      service.changePassword('user-1', {
        currentPassword: 'old-password',
        newPassword: 'new-password',
      }),
    ).resolves.toEqual({ message: 'Password updated successfully' });

    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        password: 'new-password-hash',
        refreshTokenHash: null,
        refreshTokenExpiry: null,
      },
    });
  });

  it('atomically clears the target refresh session with an admin password reset', async () => {
    await expect(
      service.resetPassword('user-1', { newPassword: 'new-password' }),
    ).resolves.toEqual({ message: 'Password reset successfully' });

    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        password: 'new-password-hash',
        refreshTokenHash: null,
        refreshTokenExpiry: null,
      },
    });
  });

  it('does not mutate credentials when the current password is incorrect', async () => {
    compareSpy.mockResolvedValue(false);

    await expect(
      service.changePassword('user-1', {
        currentPassword: 'wrong-password',
        newPassword: 'new-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(bcrypt.hash).not.toHaveBeenCalled();
  });

  it('leaves a missing admin reset target as a not-found error', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.resetPassword('missing', { newPassword: 'new-password' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it.each([
    [
      'en',
      'This account cannot be deleted while retained activity history is linked to it.',
    ],
    [
      'vi',
      'Không thể xóa tài khoản khi vẫn còn lịch sử hoạt động được lưu giữ.',
    ],
  ] as const)(
    'returns a localized 409 for retained-history P2003 failures in %s',
    async (lang, message) => {
      prisma.user.delete.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(
          'Foreign key constraint failed',
          {
            code: 'P2003',
            clientVersion: '6.19.3',
            meta: {
              modelName: 'User',
              field_name: 'AiGeneration_userId_fkey (index)',
            },
          },
        ),
      );

      const deletion = (service as any).deleteAccount('user-1', lang);
      await expect(deletion).rejects.toBeInstanceOf(ConflictException);
      await expect(deletion).rejects.toMatchObject({
        message,
        response: { statusCode: 409, message },
      });
      expect(prisma.user.delete).toHaveBeenCalledTimes(1);
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.aiGeneration.deleteMany).not.toHaveBeenCalled();
      expect(prisma.aiGenerationFeedback.deleteMany).not.toHaveBeenCalled();
      expect(prisma.aiProviderAttempt.deleteMany).not.toHaveBeenCalled();
    },
  );

  it.each([
    new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '6.19.3',
    }),
    new Error('Database unavailable'),
    { code: 'P2003', message: 'Not a Prisma request error' },
  ])(
    'preserves unrelated delete errors without wrapping them',
    async (error) => {
      prisma.user.delete.mockRejectedValue(error);

      await expect(service.deleteAccount('user-1')).rejects.toBe(error);
    },
  );

  it('keeps the successful account-deletion response unchanged', async () => {
    await expect(service.deleteAccount('user-1')).resolves.toEqual({
      message: 'Account deleted successfully',
    });
    expect(prisma.user.delete).toHaveBeenCalledWith({
      where: { id: 'user-1' },
    });
  });
});
