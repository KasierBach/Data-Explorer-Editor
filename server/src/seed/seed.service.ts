import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class SeedService {
    private readonly logger = new Logger(SeedService.name);
    private readonly SALT_ROUNDS = 10;

    constructor(private readonly prisma: PrismaService) {}

    /**
     * Seeds a default admin account if no users exist.
     */
    async seedAdmin() {
        const userCount = await this.prisma.user.count();
        if (userCount === 0) {
            const adminEmail = process.env.ADMIN_EMAIL;
            let adminPassword = process.env.ADMIN_PASSWORD;

            if (!adminEmail || !adminPassword) {
                this.logger.warn('⚠️  ADMIN_EMAIL or ADMIN_PASSWORD not set in environment variables.');
                if (!adminEmail) {
                    this.logger.error('CRITICAL: Cannot seed admin without ADMIN_EMAIL. Skipping seed.');
                    return;
                }
                // Generate a random high-entropy password if not provided
                adminPassword = require('crypto').randomBytes(16).toString('hex');
                this.logger.warn(`⚠️  Using GENERATED password for ${adminEmail}: ${adminPassword}`);
                this.logger.warn('⚠️  Please change this password immediately and configure your environment variables.');
            }
            const hashedPassword = await bcrypt.hash(adminPassword as string, this.SALT_ROUNDS);
            
            await this.prisma.user.create({
                data: {
                    firstName: 'System',
                    lastName: 'Admin',
                    email: adminEmail,
                    password: hashedPassword,
                    role: 'admin',
                    provider: 'local',
                    isOnboarded: true,
                    isEmailVerified: true,
                    username: 'admin',
                },
            });
            this.logger.log(`Default admin seeded: ${adminEmail} (password: ***)`);
        }
    }
}
