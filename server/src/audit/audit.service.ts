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
    DB_QUERY_SAVE = 'DB:QUERY_SAVE',
    DB_QUERY_UPDATE = 'DB:QUERY_UPDATE',
    DB_QUERY_DELETE = 'DB:QUERY_DELETE',
    DB_SCHEMA_CHANGE = 'DB:SCHEMA_CHANGE',
    DB_IMPORT = 'DB:IMPORT',
    DB_CONNECTION_CREATE = 'DB:CONNECTION_CREATE',
    DB_CONNECTION_DELETE = 'DB:CONNECTION_DELETE',
    DB_CONNECTION_HEALTH_CHECK = 'DB:CONNECTION_HEALTH_CHECK',
    
    // User Management
    USER_UPDATE = 'USER:UPDATE',
    USER_BAN = 'USER:BAN',
    USER_UNBAN = 'USER:UNBAN',
    
    // System Actions
    SYSTEM_CONFIG_UPDATE = 'SYSTEM:CONFIG_UPDATE'
}

export interface CreateLogParams {
    action: AuditAction | string;
    userId?: string;
    details?: any;
    ipAddress?: string;
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
                        firstName: true,
                        lastName: true,
                        email: true,
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
}
