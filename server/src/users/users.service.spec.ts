import { UsersService } from './users.service';

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
