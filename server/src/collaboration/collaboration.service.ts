import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PermissionsService } from '../permissions/services/permissions.service';
import { Permission } from '../permissions/enums/permission.enum';
import { ResourceType } from '../permissions/enums/resource-type.enum';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentParticipant, CommentReply, CommentThread } from './entities/comment.entity';

type CommentDetails = {
  commentId: string;
  threadId: string;
  parentCommentId: string | null;
  resourceType: ResourceType;
  resourceId: string;
  body: string;
  mentions?: string[];
};

const COMMENT_ACTIONS = [
  AuditAction.TEAM_COMMENT_CREATE,
  AuditAction.TEAM_COMMENT_REPLY,
  AuditAction.TEAM_COMMENT_RESOLVE,
];

@Injectable()
export class CollaborationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly permissions: PermissionsService,
    private readonly notifications: NotificationsService,
  ) {}

  async listActivity(organizationId: string, userId: string, limit = 50) {
    await this.ensureMemberAccess(organizationId, userId);
    return this.audit.findOrganizationLogs(organizationId, { limit, order: 'desc' });
  }

  async listResourceComments(
    organizationId: string,
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
  ) {
    await this.ensureMemberAccess(organizationId, userId);
    await this.permissions.ensurePermission(userId, resourceType, resourceId, Permission.READ);

    const logs = await this.audit.findOrganizationLogs(organizationId, {
      limit: 500,
      order: 'asc',
      actions: COMMENT_ACTIONS,
    });

    return this.buildCommentThreads(
      logs,
      organizationId,
      resourceType,
      resourceId,
    );
  }

  async createComment(
    organizationId: string,
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
    dto: CreateCommentDto,
  ) {
    await this.ensureMemberAccess(organizationId, userId);
    await this.permissions.ensurePermission(userId, resourceType, resourceId, Permission.COMMENT);

    const body = this.normalizeBody(dto.body);
    const commentId = randomUUID();
    const threadId = dto.parentCommentId?.trim() || commentId;
    const parentCommentId = dto.parentCommentId?.trim() || null;
    const mentions = await this.resolveMentions(organizationId, body);
    const resource = await this.loadResourceSnapshot(resourceType, resourceId);

    await this.audit.log({
      action: parentCommentId ? AuditAction.TEAM_COMMENT_REPLY : AuditAction.TEAM_COMMENT_CREATE,
      userId,
      organizationId,
      details: {
        commentId,
        threadId,
        parentCommentId,
        resourceType,
        resourceId,
        body,
        mentions: mentions.map((mention) => mention.id),
      },
    });

    const actor = await this.loadUserSnapshot(userId);
    await this.notifyMentions(mentions, actor, resource, organizationId, threadId, resourceType, resourceId);

    return this.findCommentThreadInResource(organizationId, resourceType, resourceId, threadId);
  }

  async replyToComment(
    organizationId: string,
    userId: string,
    commentId: string,
    dto: CreateCommentDto,
  ) {
    const thread = await this.findCommentThreadByCommentId(organizationId, commentId);
    return this.createComment(organizationId, userId, thread.resourceType, thread.resourceId, {
      ...dto,
      parentCommentId: commentId,
    });
  }

  async resolveComment(
    organizationId: string,
    userId: string,
    commentId: string,
  ) {
    await this.ensureMemberAccess(organizationId, userId);

    const thread = await this.findCommentThreadByCommentId(organizationId, commentId);
    const canResolve = thread.author.id === userId
      || await this.permissions.checkPermission(userId, thread.resourceType, thread.resourceId, Permission.MANAGE);

    if (!canResolve) {
      throw new ForbiddenException('Insufficient permissions to resolve this thread');
    }

    await this.audit.log({
      action: AuditAction.TEAM_COMMENT_RESOLVE,
      userId,
      organizationId,
      details: {
        commentId: thread.commentId,
        threadId: thread.threadId,
        resourceType: thread.resourceType,
        resourceId: thread.resourceId,
      },
    });

    return this.findCommentThreadInResource(organizationId, thread.resourceType, thread.resourceId, thread.threadId);
  }

  private async ensureMemberAccess(organizationId: string, userId: string) {
    const member = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member');
    }
  }

  private normalizeBody(body: string) {
    const value = body.trim();
    if (!value) {
      throw new ForbiddenException('Comment body cannot be empty');
    }

    return value.slice(0, 2000);
  }

  private parseDetails(details: string | null): CommentDetails | null {
    if (!details) {
      return null;
    }

    try {
      return JSON.parse(details) as CommentDetails;
    } catch {
      return null;
    }
  }

  private async resolveMentions(organizationId: string, body: string) {
    const tokens = Array.from(
      new Set(
        Array.from(body.matchAll(/@([a-zA-Z0-9._-]+)/g), (match) => match[1].toLowerCase()),
      ),
    );

    if (tokens.length === 0) {
      return [];
    }

    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    const normalizedMembers = members.map((member) => ({
      id: member.user.id,
      email: member.user.email,
      firstName: member.user.firstName,
      lastName: member.user.lastName,
      username: member.user.username,
      avatarUrl: member.user.avatarUrl,
      tokens: this.buildMentionTokens(member.user),
    }));

    return normalizedMembers.filter((member) => member.tokens.some((token) => tokens.includes(token)));
  }

  private buildMentionTokens(user: {
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
  }) {
    const tokens = [
      user.email.split('@')[0],
      user.username,
      user.firstName,
      user.lastName,
      [user.firstName, user.lastName].filter(Boolean).join(' '),
    ];

    return tokens
      .map((token) => token?.trim().toLowerCase())
      .filter((token): token is string => Boolean(token));
  }

  private async notifyMentions(
    mentions: Array<{ id: string; email: string; firstName?: string | null; lastName?: string | null; username?: string | null; avatarUrl?: string | null }>,
    actor: CommentParticipant,
    resource: { name?: string | null; ownerId: string | null },
    organizationId: string,
    threadId: string,
    resourceType: ResourceType,
    resourceId: string,
  ) {
    const targetIds = new Set(mentions.map((mention) => mention.id));
    if (resource.ownerId && resource.ownerId !== actor.id) {
      targetIds.add(resource.ownerId);
    }

    if (targetIds.size === 0) {
      return;
    }

    const message = resource.name
      ? `${actor.firstName || actor.email} commented on "${resource.name}"`
      : `${actor.firstName || actor.email} commented on a shared resource`;

    await this.notifications.emitMany(Array.from(targetIds), 'comment', message, {
      organizationId,
      threadId,
      resourceType,
      resourceId,
    });
  }

  private async loadUserSnapshot(userId: string): Promise<CommentParticipant> {
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

  private async loadResourceSnapshot(resourceType: ResourceType, resourceId: string) {
    switch (resourceType) {
      case ResourceType.CONNECTION: {
        const resource = await this.prisma.connection.findUnique({
          where: { id: resourceId },
          select: { name: true, userId: true, organizationId: true },
        });
        if (!resource) throw new NotFoundException('Connection not found');
        return { name: resource.name, ownerId: resource.userId, organizationId: resource.organizationId };
      }
      case ResourceType.QUERY: {
        const resource = await this.prisma.savedQuery.findUnique({
          where: { id: resourceId },
          select: { name: true, userId: true, organizationId: true },
        });
        if (!resource) throw new NotFoundException('Saved query not found');
        return { name: resource.name, ownerId: resource.userId, organizationId: resource.organizationId };
      }
      case ResourceType.DASHBOARD: {
        const resource = await this.prisma.dashboard.findUnique({
          where: { id: resourceId },
          select: { name: true, userId: true, organizationId: true },
        });
        if (!resource) throw new NotFoundException('Dashboard not found');
        return { name: resource.name, ownerId: resource.userId, organizationId: resource.organizationId };
      }
      case ResourceType.ERD: {
        const resource = await this.prisma.erdWorkspace.findUnique({
          where: { id: resourceId },
          select: { name: true, userId: true, organizationId: true },
        });
        if (!resource) throw new NotFoundException('ERD workspace not found');
        return { name: resource.name, ownerId: resource.userId, organizationId: resource.organizationId };
      }
      default:
        return { name: null, ownerId: null, organizationId: null };
    }
  }

  private async buildCommentThreads(
    logs: Array<{ action: string; userId?: string | null; createdAt: Date; details: string | null; user?: CommentParticipant | null }>,
    organizationId: string,
    resourceType?: ResourceType,
    resourceId?: string,
  ) {
    const threads = new Map<string, CommentThread>();

    for (const log of logs) {
      const details = this.parseDetails(log.details);
      if (!details) {
        continue;
      }

      if (resourceType && resourceId && (details.resourceType !== resourceType || details.resourceId !== resourceId)) {
        continue;
      }

      if (!log.user && !log.userId) {
        continue;
      }

      const author = this.normalizeParticipant(log.user ?? await this.loadUserSnapshot(log.userId as string));
      const mentions = await this.resolveMentionSnapshots(organizationId, details.mentions ?? []);

      if (log.action === AuditAction.TEAM_COMMENT_RESOLVE) {
        const thread = threads.get(details.threadId);
        if (thread) {
          thread.resolvedAt = log.createdAt.toISOString();
          thread.resolvedBy = author;
          thread.updatedAt = log.createdAt.toISOString();
        }
        continue;
      }

      if (details.parentCommentId) {
        const reply: CommentReply = {
          commentId: details.commentId,
          threadId: details.threadId,
          parentCommentId: details.parentCommentId,
          body: details.body,
          author,
          mentions,
          createdAt: log.createdAt.toISOString(),
          updatedAt: log.createdAt.toISOString(),
        };

        const thread = threads.get(details.threadId);
        if (thread) {
          thread.replies.push(reply);
          thread.updatedAt = log.createdAt.toISOString();
        }
        continue;
      }

      threads.set(details.threadId, {
        commentId: details.commentId,
        threadId: details.threadId,
        parentCommentId: null,
        resourceType: details.resourceType,
        resourceId: details.resourceId,
        organizationId,
        body: details.body,
        author,
        mentions,
        createdAt: log.createdAt.toISOString(),
        updatedAt: log.createdAt.toISOString(),
        resolvedAt: null,
        resolvedBy: null,
        replies: [],
      });
    }

    return Array.from(threads.values())
      .map((thread) => ({
        ...thread,
        replies: thread.replies.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private async findCommentThreadInResource(
    organizationId: string,
    resourceType: ResourceType,
    resourceId: string,
    threadId: string,
  ) {
    const logs = await this.audit.findOrganizationLogs(organizationId, {
      limit: 500,
      order: 'asc',
      actions: COMMENT_ACTIONS,
    });
    const threads = await this.buildCommentThreads(logs, organizationId, resourceType, resourceId);
    const thread = threads.find((entry) =>
      entry.threadId === threadId
      || entry.commentId === threadId
      || entry.replies.some((reply) => reply.commentId === threadId),
    );
    if (!thread) {
      throw new NotFoundException('Comment thread not found');
    }
    return thread;
  }

  private async findCommentThreadByCommentId(organizationId: string, commentId: string) {
    const logs = await this.audit.findOrganizationLogs(organizationId, {
      limit: 500,
      order: 'asc',
      actions: COMMENT_ACTIONS,
    });

    const threads = await this.buildCommentThreads(logs, organizationId);
    const thread = threads.find((entry) =>
      entry.threadId === commentId
      || entry.commentId === commentId
      || entry.replies.some((reply) => reply.commentId === commentId),
    );
    if (thread) {
      return thread;
    }

    throw new NotFoundException('Comment thread not found');
  }

  private async resolveMentionSnapshots(organizationId: string, mentionIds: string[]) {
    if (mentionIds.length === 0) {
      return [];
    }

    const members = await this.prisma.organizationMember.findMany({
      where: {
        organizationId,
        userId: {
          in: mentionIds,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    return members.map((member) => this.normalizeParticipant(member.user));
  }

  private normalizeParticipant(user: CommentParticipant) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      username: user.username ?? null,
      avatarUrl: user.avatarUrl ?? null,
    };
  }
}
