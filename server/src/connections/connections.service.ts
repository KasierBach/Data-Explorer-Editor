import { Injectable, NotFoundException, OnModuleDestroy, BadRequestException } from '@nestjs/common';
import { CreateConnectionDto } from './dto/create-connection.dto';
import { UpdateConnectionDto } from './dto/update-connection.dto';
import { Connection } from './entities/connection.entity';
import { PrismaService } from '../prisma/prisma.service';
import { DatabaseStrategyFactory } from '../database-strategies/strategy.factory';
import { encryptAttribute, decryptAttribute } from '../utils/crypto.util';
import { AuditService, AuditAction } from '../audit/audit.service';
import { SshTunnelService } from './ssh-tunnel.service';
import { OrganizationsService } from '../organizations/services/organizations.service';
import { ResourceType } from '../permissions/enums/resource-type.enum';
import { getErrorMessage } from '../common/utils/error.util';

@Injectable()
export class ConnectionsService implements OnModuleDestroy {
  private pools = new Map<string, { pool: any; lastAccessed: number }>();
  private readonly POOL_TTL = 15 * 60 * 1000; // 15 mins
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(
    private prisma: PrismaService,
    private strategyFactory: DatabaseStrategyFactory,
    private auditService: AuditService,
    private sshTunnelService: SshTunnelService,
    private organizationsService: OrganizationsService,
  ) {
    // Run cleanup every minute
    this.cleanupInterval = setInterval(() => this.cleanupPools(), 60000);
  }

  private sanitizeConnection<T extends { password?: string | null }>(connection: T) {
    const { password: _, ...safe } = connection;
    return safe;
  }

  private requiresExplicitHost(type: string) {
    return !['sqlite', 'mock'].includes(type);
  }

  private normalizeHost(host?: string | null) {
    const normalized = host?.trim();
    return normalized ? normalized : null;
  }

  private ensureHostConfigured(type: string, host?: string | null) {
    if (this.requiresExplicitHost(type) && !this.normalizeHost(host)) {
      throw new BadRequestException('Host is required for this connection type.');
    }
  }

  private async ensureOrganizationMembership(organizationId: string, userId: string) {
    await this.organizationsService.ensureMemberAccess(organizationId, userId);
  }

  private async updateHealthState(
    id: string,
    health: {
      status: 'healthy' | 'error';
      latencyMs?: number | null;
      error?: string | null;
      connected?: boolean;
    },
  ) {
    await this.prisma.connection.update({
      where: { id },
      data: {
        lastHealthCheckAt: new Date(),
        lastHealthStatus: health.status,
        lastHealthError: health.error ?? null,
        lastConnectionLatencyMs: health.latencyMs ?? null,
        ...(health.connected ? { lastConnectedAt: new Date() } : {}),
      },
    });
  }

  private async pingPool(pool: any, type: string) {
    switch (type) {
      case 'postgres':
        await pool.query('SELECT 1');
        return;
      case 'mysql':
        await pool.query('SELECT 1');
        return;
      case 'mssql':
        await pool.request().query('SELECT 1');
        return;
      case 'mongodb':
      case 'mongodb+srv':
        await pool.db().admin().ping();
        return;
      default:
        return;
    }
  }

  /**
   * Generic fallback for closing a pool when the strategy/connection is unavailable.
   */
  private async fallbackClosePool(pool: any): Promise<void> {
    try {
      if (typeof pool.end === 'function') await pool.end();
      else if (typeof pool.close === 'function') await pool.close();
    } catch {
      // Ignore fallback close errors
    }
  }

  /**
   * Safely closes a pool by its key and removes it from the pool map.
   * Tries strategy-based close first, falls back to generic end/close methods.
   */
  private async closePoolByKey(key: string, options?: { silent?: boolean }): Promise<void> {
    const poolData = this.pools.get(key);
    if (!poolData) return;

    try {
      const id = key.split(':')[0];
      const connection = await this.prisma.connection.findUnique({ where: { id } });
      if (connection) {
        const strategy = this.strategyFactory.getStrategy(connection.type);
        await strategy.closePool(poolData.pool);
      } else {
        await this.fallbackClosePool(poolData.pool);
      }
    } catch {
      await this.fallbackClosePool(poolData.pool);
    } finally {
      this.pools.delete(key);
    }
  }

  /**
   * Closes all pools belonging to a specific connection ID.
   */
  private async closePoolsByConnectionId(connectionId: string): Promise<void> {
    for (const key of [...this.pools.keys()]) {
      if (key.startsWith(`${connectionId}:`)) {
        await this.closePoolByKey(key, { silent: true });
      }
    }
  }

  private async cleanupPools() {
    const now = Date.now();
    for (const [key, { lastAccessed }] of this.pools.entries()) {
      if (now - lastAccessed > this.POOL_TTL) {
        await this.closePoolByKey(key, { silent: true });
      }
    }
  }

  async onModuleDestroy() {
    clearInterval(this.cleanupInterval);
    for (const key of [...this.pools.keys()]) {
      await this.closePoolByKey(key);
    }
  }

  async create(createConnectionDto: CreateConnectionDto, userId: string): Promise<Connection> {
    const { name, password, organizationId, ...rest } = createConnectionDto;
    const encryptedPassword = password ? encryptAttribute(password) : undefined;
    const teamOrganizationId = organizationId?.trim() || null;
    this.ensureHostConfigured(createConnectionDto.type, createConnectionDto.host);

    if (teamOrganizationId) {
      await this.ensureOrganizationMembership(teamOrganizationId, userId);
    }

    const normalizedHost = this.normalizeHost(createConnectionDto.host);
    const hasHost = Object.prototype.hasOwnProperty.call(createConnectionDto, 'host');

    const connection = await this.prisma.connection.create({
      data: {
        ...rest,
        ...(hasHost ? { host: normalizedHost } : {}),
        name,
        password: encryptedPassword,
        userId,
        readOnly: createConnectionDto.readOnly ?? false,
        allowSchemaChanges: createConnectionDto.readOnly ? false : (createConnectionDto.allowSchemaChanges ?? true),
        allowImportExport: createConnectionDto.readOnly ? false : (createConnectionDto.allowImportExport ?? true),
        allowQueryExecution: createConnectionDto.allowQueryExecution ?? true,
        ...(teamOrganizationId ? { organizationId: teamOrganizationId } : {}),
      } as any,
    });
    const safeConnection = this.sanitizeConnection(connection);

    await this.auditService.log({
      action: AuditAction.DB_CONNECTION_CREATE,
      userId,
      organizationId: teamOrganizationId ?? undefined,
      details: { name: connection.name, type: connection.type, database: connection.database },
    });

    if (teamOrganizationId) {
      await this.organizationsService.ensureResourcePolicy(
        ResourceType.CONNECTION,
        connection.id,
        teamOrganizationId,
      );

      await this.auditService.log({
        action: AuditAction.TEAM_RESOURCE_SHARE,
        userId,
        organizationId: teamOrganizationId,
        details: {
          resourceType: ResourceType.CONNECTION,
          resourceId: connection.id,
          resourceName: connection.name,
        },
      });
    }

    return safeConnection as unknown as Connection;
  }

  async test(createConnectionDto: CreateConnectionDto): Promise<{ status: string; latencyMs: number; error: string | null }> {
    this.ensureHostConfigured(createConnectionDto.type, createConnectionDto.host);
    const strategy = this.strategyFactory.getStrategy(createConnectionDto.type);
    const startedAt = Date.now();
    let pool: any;

    try {
      pool = await strategy.createPool(createConnectionDto);
      await this.pingPool(pool, createConnectionDto.type);

      return {
        status: 'healthy',
        latencyMs: Date.now() - startedAt,
        error: null,
      };
    } catch (error) {
      return {
        status: 'error',
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    } finally {
      if (pool) {
        await strategy.closePool(pool).catch(() => undefined);
      }
    }
  }


  async findAll(userId: string): Promise<Connection[]> {
    const connections = await this.prisma.connection.findMany({
      where: {
        OR: [
          { userId },
          { organization: { members: { some: { userId } } } },
        ],
      },
    });
    return connections.map(c => this.sanitizeConnection(c)) as unknown as Connection[];
  }

  private async findRawOne(id: string, userId: string) {
    const connection = await this.prisma.connection.findFirst({
      where: {
        id,
        OR: [
          { userId },
          { organization: { members: { some: { userId } } } },
        ],
      },
    });
    if (!connection) {
      throw new NotFoundException(`Connection with ID ${id} not found or you don't have permission`);
    }
    return connection;
  }

  async findOne(id: string, userId: string): Promise<Connection> {
    const connection = await this.findRawOne(id, userId);
    const safeConnection = this.sanitizeConnection(connection);
    return safeConnection as unknown as Connection;
  }

  /**
   * Retrieves a connection with the password decrypted.
   * Internal use only (e.g. MigrationService).
   */
  async getDecryptedConnection(id: string, userId: string) {
    const connection = await this.findRawOne(id, userId);
    const decryptedPassword = connection.password ? decryptAttribute(connection.password) : undefined;
    return { ...connection, password: decryptedPassword };
  }

  async getPool(id: string, databaseOverride?: string, userId?: string) {
    let connection: any;
    if (!userId) {
      // if userId isn't provided (e.g from legacy code), fallback to system fetch
      const sysConnection = await this.prisma.connection.findUnique({ where: { id } });
      if (!sysConnection) throw new NotFoundException(`Connection ${id} not found`);
      connection = sysConnection;
    } else {
      connection = await this.findRawOne(id, userId);
    }
    const poolKey = `${id}:${databaseOverride || connection.database}`;

    if (this.pools.has(poolKey)) {
      const poolData = this.pools.get(poolKey);
      if (poolData) {
        poolData.lastAccessed = Date.now();
        return poolData.pool;
      }
    }

    const decryptedPassword = connection.password ? decryptAttribute(connection.password) : undefined;
    let connectionWithDecryptedPassword = { ...connection, password: decryptedPassword };

    const connAny = connection as any;
    if (connAny.sshHost && connAny.sshUsername) {
      const dbHost = this.normalizeHost(connection.host);
      if (!dbHost) {
        throw new BadRequestException('Host is required for SSH tunnel connections.');
      }

      const localPort = await this.sshTunnelService.openTunnel(poolKey, {
        sshHost: connAny.sshHost,
        sshPort: connAny.sshPort || 22,
        sshUsername: connAny.sshUsername,
        sshPrivateKey: connAny.sshPrivateKey || undefined,
        sshPassphrase: connAny.sshPassphrase || undefined,
        dbHost,
        dbPort: connection.port || 5432,
      });
      connectionWithDecryptedPassword = {
        ...connectionWithDecryptedPassword,
        host: '127.0.0.1',
        port: localPort,
      };
    }

    const strategy = this.strategyFactory.getStrategy(connection.type);
    try {
      const pool = await strategy.createPool(connectionWithDecryptedPassword, databaseOverride);

      this.pools.set(poolKey, { pool, lastAccessed: Date.now() });
      await this.updateHealthState(id, { status: 'healthy', connected: true });
      return pool;
    } catch (error) {
      await this.updateHealthState(id, {
        status: 'error',
        error: getErrorMessage(error) || 'Connection failed',
      });
      throw error;
    }
  }

  async update(id: string, updateConnectionDto: UpdateConnectionDto, userId: string): Promise<Connection> {
    const connection = await this.findRawOne(id, userId);

    // Close existing pools for this connection if config changed
    await this.closePoolsByConnectionId(id);

    const { password, ...rest } = updateConnectionDto;
    const encryptedPassword = password !== undefined && password !== null ? encryptAttribute(password) : undefined;
    const hasOrganizationId = Object.prototype.hasOwnProperty.call(updateConnectionDto, 'organizationId');
    const nextOrganizationId = hasOrganizationId
      ? (updateConnectionDto.organizationId?.trim() || null)
      : connection.organizationId ?? null;
    const hasHost = Object.prototype.hasOwnProperty.call(updateConnectionDto, 'host');
    const nextType = updateConnectionDto.type ?? connection.type;
    const nextHost = hasHost ? updateConnectionDto.host : connection.host;
    this.ensureHostConfigured(nextType, nextHost);
    if (hasOrganizationId && nextOrganizationId && nextOrganizationId !== connection.organizationId) {
      await this.ensureOrganizationMembership(nextOrganizationId, userId);
    }
    const readOnly =
      updateConnectionDto.readOnly !== undefined
        ? updateConnectionDto.readOnly
        : connection.readOnly;
    const dataToUpdate = {
      ...rest,
      ...(hasHost ? { host: this.normalizeHost(nextHost) } : {}),
      ...(password !== undefined && password !== null ? { password: encryptedPassword } : {}),
      readOnly,
      allowSchemaChanges: readOnly ? false : (updateConnectionDto.allowSchemaChanges ?? connection.allowSchemaChanges),
      allowImportExport: readOnly ? false : (updateConnectionDto.allowImportExport ?? connection.allowImportExport),
      allowQueryExecution: updateConnectionDto.allowQueryExecution ?? connection.allowQueryExecution,
      ...(hasOrganizationId ? { organizationId: nextOrganizationId } : {}),
    };

    const updatedConnection = await this.prisma.connection.update({
      where: { id },
      data: dataToUpdate,
    });

    if (connection.organizationId && connection.organizationId !== nextOrganizationId) {
      await this.organizationsService.removeResourcePolicy(
        ResourceType.CONNECTION,
        id,
        connection.organizationId,
      );

      await this.auditService.log({
        action: AuditAction.TEAM_RESOURCE_UNSHARE,
        userId,
        organizationId: connection.organizationId,
        details: {
          resourceType: ResourceType.CONNECTION,
          resourceId: id,
          resourceName: updatedConnection.name,
        },
      });
    }

    if (nextOrganizationId) {
      await this.organizationsService.ensureResourcePolicy(
        ResourceType.CONNECTION,
        id,
        nextOrganizationId,
      );

      if (nextOrganizationId !== connection.organizationId) {
        await this.auditService.log({
          action: AuditAction.TEAM_RESOURCE_SHARE,
          userId,
          organizationId: nextOrganizationId,
          details: {
            resourceType: ResourceType.CONNECTION,
            resourceId: id,
            resourceName: updatedConnection.name,
          },
        });
      }
    }

    const safeConnection = this.sanitizeConnection(updatedConnection);
    return safeConnection as unknown as Connection;
  }

  async remove(id: string, userId: string): Promise<void> {
    const connection = await this.findRawOne(id, userId);

    // Close pools
    await this.closePoolsByConnectionId(id);

    await this.prisma.connection.delete({
      where: { id },
    });

    await this.auditService.log({
      action: AuditAction.DB_CONNECTION_DELETE,
      userId,
      details: { name: connection.name, type: connection.type }
    });
  }

  async removePool(poolKey: string, userId?: string): Promise<void> {
    await this.closePoolByKey(poolKey);
  }

  async checkHealth(id: string, userId: string) {
    const connection = await this.getDecryptedConnection(id, userId);
    const strategy = this.strategyFactory.getStrategy(connection.type);
    const startedAt = Date.now();
    let pool: any;

    try {
      pool = await strategy.createPool(connection);
      await this.pingPool(pool, connection.type);

      const health = {
        status: 'healthy' as const,
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        error: null,
      };

      await this.updateHealthState(id, {
        status: 'healthy',
        latencyMs: health.latencyMs,
        connected: true,
      });

      await this.auditService.log({
        action: AuditAction.DB_CONNECTION_HEALTH_CHECK,
        userId,
        details: { connectionId: id, ...health },
      });

      return health;
    } catch (error) {
      const health = {
        status: 'error' as const,
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        error: getErrorMessage(error) || 'Connection failed',
      };

      await this.updateHealthState(id, {
        status: 'error',
        latencyMs: health.latencyMs,
        error: health.error,
      });

      await this.auditService.log({
        action: AuditAction.DB_CONNECTION_HEALTH_CHECK,
        userId,
        details: { connectionId: id, ...health },
      });

      return health;
    } finally {
      if (pool) {
        await strategy.closePool(pool).catch(() => undefined);
      }
    }
  }
}
