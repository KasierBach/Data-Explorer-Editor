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
            const adminEmail = process.env.ADMIN_EMAIL || 'admin@dataexplorer.com';
            const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
            const hashedPassword = await bcrypt.hash(adminPassword, this.SALT_ROUNDS);
            
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
