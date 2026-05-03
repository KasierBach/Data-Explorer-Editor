import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export enum AuditAction {
    // Auth Actions
    AUTH_LOGIN_SUCCESS = 'AUTH:LOGIN_SUCCESS',
    AUTH_LOGIN_FAILED = 'AUTH:LOGIN_FAILED',
    AUTH_LOGOUT = 'AUTH:LOGOUT',
    AUTH_REGISTER = 'AUTH:REGISTER',
    
    // Database Actions
    DB_QUERY_EXECUTE = 'DB:QUERY_EXECUTE',
    DB_QUERY_BLOCKED = 'DB:QUERY_BLOCKED',
    DB_QUERY_DESTRUCTIVE_CONFIRMED = 'DB:QUERY_DESTRUCTIVE_CONFIRMED',
    DB_QUERY_SAVE = 'DB:QUERY_SAVE',
    DB_QUERY_UPDATE = 'DB:QUERY_UPDATE',
    DB_QUERY_DELETE = 'DB:QUERY_DELETE',
    DB_SCHEMA_CHANGE = 'DB:SCHEMA_CHANGE',
    DB_IMPORT = 'DB:IMPORT',
    DB_CONNECTION_CREATE = 'DB:CONNECTION_CREATE',
    DB_CONNECTION_DELETE = 'DB:CONNECTION_DELETE',
    DB_CONNECTION_HEALTH_CHECK = 'DB:CONNECTION_HEALTH_CHECK',
    DASHBOARD_CREATE = 'DB:DASHBOARD_CREATE',
    DASHBOARD_UPDATE = 'DB:DASHBOARD_UPDATE',
    DASHBOARD_DELETE = 'DB:DASHBOARD_DELETE',
    DASHBOARD_WIDGET_CREATE = 'DB:DASHBOARD_WIDGET_CREATE',
    DASHBOARD_WIDGET_DELETE = 'DB:DASHBOARD_WIDGET_DELETE',
    ERD_WORKSPACE_CREATE = 'DB:ERD_WORKSPACE_CREATE',
    ERD_WORKSPACE_UPDATE = 'DB:ERD_WORKSPACE_UPDATE',
    ERD_WORKSPACE_DELETE = 'DB:ERD_WORKSPACE_DELETE',
    
    // User Management
    USER_UPDATE = 'USER:UPDATE',
    USER_BAN = 'USER:BAN',
    USER_UNBAN = 'USER:UNBAN',
    
    // System Actions
    SYSTEM_CONFIG_UPDATE = 'SYSTEM:CONFIG_UPDATE',
    
    // Team Actions
    TEAM_CREATE = 'TEAM:CREATE',
    TEAM_MEMBER_INVITE = 'TEAM:MEMBER_INVITE',
    TEAM_MEMBER_ACCEPT = 'TEAM:MEMBER_ACCEPT',
    TEAM_MEMBER_REMOVE = 'TEAM:MEMBER_REMOVE',
    TEAM_MEMBER_ROLE_CHANGE = 'TEAM:MEMBER_ROLE_CHANGE',
    TEAM_RESOURCE_SHARE = 'TEAM:RESOURCE_SHARE',
    TEAM_RESOURCE_UNSHARE = 'TEAM:RESOURCE_UNSHARE',
    TEAMSPACE_CREATE = 'TEAM:TEAMSPACE_CREATE',
    TEAMSPACE_UPDATE = 'TEAM:TEAMSPACE_UPDATE',
    TEAMSPACE_DELETE = 'TEAM:TEAMSPACE_DELETE',
    TEAMSPACE_RESOURCE_ASSIGN = 'TEAM:TEAMSPACE_RESOURCE_ASSIGN',
    TEAM_COMMENT_CREATE = 'TEAM:COMMENT_CREATE',
    TEAM_COMMENT_REPLY = 'TEAM:COMMENT_REPLY',
    TEAM_COMMENT_RESOLVE = 'TEAM:COMMENT_RESOLVE',
}

export interface CreateLogParams {
    action: AuditAction | string;
    userId?: string;
    organizationId?: string;
    details?: any;
    ipAddress?: string;
}

export interface OrganizationLogQueryOptions {
    limit?: number;
    actions?: string[];
    order?: 'asc' | 'desc';
}

@Injectable()
export class AuditService {
    constructor(private readonly prisma: PrismaService) { }

    async log(params: CreateLogParams) {
        try {
            await this.prisma.auditLog.create({
                data: {
                    action: params.action,
                    userId: params.userId,
                    organizationId: params.organizationId,
                    details: params.details ? JSON.stringify(params.details) : null,
                    ipAddress: params.ipAddress,
                }
            });
        } catch (error) {
            console.error('[AuditService] Failed to record audit log', error);
        }
    }

    async getLogs(limit: number = 100) {
        return this.prisma.auditLog.findMany({
            take: limit,
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        username: true,
                        avatarUrl: true,
                    }
                }
            }
        });
    }

    async getLogsByUser(userId: string, limit: number = 100) {
        return this.prisma.auditLog.findMany({
            where: {
                userId,
                action: AuditAction.DB_QUERY_EXECUTE, // Only query history for this view
            },
            take: limit,
            orderBy: {
                createdAt: 'desc'
            },
        });
    }

    async getOrganizationLogs(organizationId: string, limit: number = 50) {
        return this.findOrganizationLogs(organizationId, { limit });
    }

    async findOrganizationLogs(organizationId: string, options: OrganizationLogQueryOptions = {}) {
        return this.prisma.auditLog.findMany({
            where: {
                organizationId,
                ...(options.actions?.length ? { action: { in: options.actions } } : {}),
            },
            take: options.limit ?? 50,
            orderBy: {
                createdAt: options.order ?? 'desc'
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        username: true,
                        avatarUrl: true,
                    }
                }
            }
        });
    }
}
