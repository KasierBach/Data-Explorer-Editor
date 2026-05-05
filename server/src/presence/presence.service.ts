import { ForbiddenException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../permissions/services/permissions.service';
import { Permission } from '../permissions/enums/permission.enum';
import { ResourceType } from '../permissions/enums/resource-type.enum';

export interface PresenceParticipant {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  avatarUrl: string | null;
}

export interface PresenceEntry extends PresenceParticipant {
  displayName: string;
  lastSeen: number;
}

type PresenceScope =
  | {
      kind: 'teamspace';
      organizationId: string;
      teamspaceId: string;
    }
  | {
      kind: 'resource';
      organizationId: string;
      resourceType: ResourceType;
      resourceId: string;
    };

@Injectable()
export class PresenceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PresenceService.name);
  private redis: Redis | null = null;
  private readonly staleWindowMs = 90_000;
  private readonly presenceTtlSeconds = 180;

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl);
  }

  onModuleDestroy() {
    this.redis?.quit();
  }

  async heartbeatTeamspace(organizationId: string, teamspaceId: string, userId: string) {
    await this.assertTeamspaceAccess(organizationId, teamspaceId, userId);
    return this.heartbeat({
      kind: 'teamspace',
      organizationId,
      teamspaceId,
    }, userId);
  }

  async listTeamspacePresence(organizationId: string, teamspaceId: string, userId: string) {
    await this.assertTeamspaceAccess(organizationId, teamspaceId, userId);
    return this.list({
      kind: 'teamspace',
      organizationId,
      teamspaceId,
    });
  }

  async leaveTeamspace(organizationId: string, teamspaceId: string, userId: string) {
    await this.assertTeamspaceAccess(organizationId, teamspaceId, userId);
    await this.leave({
      kind: 'teamspace',
      organizationId,
      teamspaceId,
    }, userId);
    return { success: true };
  }

  async heartbeatResource(organizationId: string, resourceType: ResourceType, resourceId: string, userId: string) {
    await this.permissions.ensurePermission(userId, resourceType, resourceId, Permission.READ);
    return this.heartbeat({
      kind: 'resource',
      organizationId,
      resourceType,
      resourceId,
    }, userId);
  }

  async listResourcePresence(organizationId: string, resourceType: ResourceType, resourceId: string, userId: string) {
    await this.permissions.ensurePermission(userId, resourceType, resourceId, Permission.READ);
    return this.list({
      kind: 'resource',
      organizationId,
      resourceType,
      resourceId,
    });
  }

  async leaveResource(organizationId: string, resourceType: ResourceType, resourceId: string, userId: string) {
    await this.permissions.ensurePermission(userId, resourceType, resourceId, Permission.READ);
    await this.leave({
      kind: 'resource',
      organizationId,
      resourceType,
      resourceId,
    }, userId);
    return { success: true };
  }

  private requireRedis() {
    if (!this.redis) {
      throw new Error('Presence storage is not initialized.');
    }

    return this.redis;
  }

  private scopeKey(scope: PresenceScope) {
    if (scope.kind === 'teamspace') {
      return `presence:organizations:${scope.organizationId}:teamspaces:${scope.teamspaceId}`;
    }

    return `presence:organizations:${scope.organizationId}:resources:${scope.resourceType}:${scope.resourceId}`;
  }

  private displayName(user: PresenceParticipant) {
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    return fullName || user.username || user.email;
  }

  private async loadUser(userId: string): Promise<PresenceParticipant> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        username: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async assertTeamspaceAccess(organizationId: string, teamspaceId: string, userId: string) {
    const [member, teamspace] = await Promise.all([
      this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId,
          },
        },
      }),
      this.prisma.teamspace.findFirst({
        where: {
          id: teamspaceId,
          organizationId,
        },
        select: { id: true },
      }),
    ]);

    if (!member) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    if (!teamspace) {
      throw new NotFoundException('Teamspace not found');
    }
  }

  private async heartbeat(scope: PresenceScope, userId: string): Promise<PresenceEntry[]> {
    const redis = this.requireRedis();
    const user = await this.loadUser(userId);
    const now = Date.now();
    const entry: PresenceEntry = {
      ...user,
      displayName: this.displayName(user),
      lastSeen: now,
    };

    const key = this.scopeKey(scope);
    await redis.hset(key, userId, JSON.stringify(entry));
    await redis.expire(key, this.presenceTtlSeconds);

    return this.list(scope);
  }

  private async list(scope: PresenceScope): Promise<PresenceEntry[]> {
    const redis = this.requireRedis();
    const key = this.scopeKey(scope);
    const payload = await redis.hgetall(key);
    const now = Date.now();
    const staleUserIds: string[] = [];

    const entries = Object.entries(payload)
      .map(([userId, raw]) => {
        try {
          const parsed = JSON.parse(raw) as PresenceEntry;
          if (typeof parsed.lastSeen !== 'number') {
            staleUserIds.push(userId);
            return null;
          }

          if (now - parsed.lastSeen > this.staleWindowMs) {
            staleUserIds.push(userId);
            return null;
          }

          return parsed;
        } catch {
          staleUserIds.push(userId);
          return null;
        }
      })
      .filter((entry): entry is PresenceEntry => Boolean(entry))
      .sort((a, b) => b.lastSeen - a.lastSeen);

    if (staleUserIds.length > 0) {
      await redis.hdel(key, ...staleUserIds);
    }

    return entries;
  }

  private async leave(scope: PresenceScope, userId: string) {
    const redis = this.requireRedis();
    const key = this.scopeKey(scope);
    await redis.hdel(key, userId);
  }
}
