import { Logger } from '@nestjs/common';
import { SeedService } from './seed.service';

describe('SeedService', () => {
  const originalAdminEmail = process.env.ADMIN_EMAIL;
  const originalAdminPassword = process.env.ADMIN_PASSWORD;

  afterEach(() => {
    if (originalAdminEmail === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = originalAdminEmail;
    if (originalAdminPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = originalAdminPassword;
    jest.restoreAllMocks();
  });

  it('skips seeding instead of logging a generated password', async () => {
    process.env.ADMIN_EMAIL = 'admin@example.test';
    delete process.env.ADMIN_PASSWORD;

    const create = jest.fn();
    const prisma = { user: { count: jest.fn().mockResolvedValue(0), create } } as any;
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const service = new SeedService(prisma);

    await service.seedAdmin();

    expect(create).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.not.stringContaining('admin@example.test'),
    );
  });
});