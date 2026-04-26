import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { CreateConnectionDto } from './dto/create-connection.dto';
import { UpdateConnectionDto } from './dto/update-connection.dto';
import { Connection } from './entities/connection.entity';
import { PrismaService } from '../prisma/prisma.service';
import { DatabaseStrategyFactory } from '../database-strategies/strategy.factory';
import { encryptAttribute, decryptAttribute } from '../utils/crypto.util';
import { AuditService, AuditAction } from '../audit/audit.service';
import { SshTunnelService } from './ssh-tunnel.service';

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
  ) {
    // Run cleanup every minute
    this.cleanupInterval = setInterval(() => this.cleanupPools(), 60000);
  }

  private sanitizeConnection<T extends { password?: string | null }>(connection: T) {
    const { password: _, ...safe } = connection;
    return safe;
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

  private async cleanupPools() {
    const now = Date.now();
    for (const [key, { pool, lastAccessed }] of this.pools.entries()) {
      if (now - lastAccessed > this.POOL_TTL) {
        try {
          const id = key.split(':')[0];
          const connection = await this.prisma.connection.findUnique({ where: { id } });
          if (connection) {
            const strategy = this.strategyFactory.getStrategy(connection.type);
            await strategy.closePool(pool);
          } else {
            // fallback generic close
            if (typeof pool.end === 'function') await pool.end();
            if (typeof pool.close === 'function') await pool.close();
          }
        } catch (err) {
          // Silently ignore pool close errors during cleanup
        } finally {
          this.pools.delete(key);
        }
      }
    }
  }

  async onModuleDestroy() {
    clearInterval(this.cleanupInterval);
    for (const [key, poolData] of this.pools.entries()) {
      const id = key.split(':')[0];
      const connection = await this.prisma.connection.findUnique({ where: { id } });
      if (connection) {
        const strategy = this.strategyFactory.getStrategy(connection.type);
        await strategy.closePool(poolData.pool);
      }
    }
  }

    async create(createConnectionDto: CreateConnectionDto, userId: string): Promise<Connection> {
        const { name, password, organizationId, ...rest } = createConnectionDto;
        const encryptedPassword = password ? encryptAttribute(password) : undefined;

        const connection = await this.prisma.connection.create({
            data: {
                ...rest,
                name,
                password: encryptedPassword,
                userId,
                readOnly: createConnectionDto.readOnly ?? false,
                allowSchemaChanges: createConnectionDto.readOnly ? false : (createConnectionDto.allowSchemaChanges ?? true),
                allowImportExport: createConnectionDto.readOnly ? false : (createConnectionDto.allowImportExport ?? true),
                allowQueryExecution: createConnectionDto.allowQueryExecution ?? true,
                ...(organizationId ? { organizationId } : {}),
            } as any,
        });
    const safeConnection = this.sanitizeConnection(connection);

    await this.auditService.log({
      action: AuditAction.DB_CONNECTION_CREATE,
      userId,
      details: { name: connection.name, type: connection.type, database: connection.database }
    });

    return safeConnection as unknown as Connection;
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
    if (!userId) {
      // if userId isn't provided (e.g from legacy code), fallback to system fetch
      const sysConnection = await this.prisma.connection.findUnique({ where: { id } });
      if (!sysConnection) throw new NotFoundException(`Connection ${id} not found`);
      var connection = sysConnection;
    } else {
      var connection = await this.findRawOne(id, userId);
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
      const localPort = await this.sshTunnelService.openTunnel(poolKey, {
        sshHost: connAny.sshHost,
        sshPort: connAny.sshPort || 22,
        sshUsername: connAny.sshUsername,
        sshPrivateKey: connAny.sshPrivateKey || undefined,
        sshPassphrase: connAny.sshPassphrase || undefined,
        dbHost: connection.host || 'localhost',
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
        error: error instanceof Error ? error.message : 'Connection failed',
      });
      throw error;
    }
  }

  async update(id: string, updateConnectionDto: UpdateConnectionDto, userId: string): Promise<Connection> {
    const connection = await this.findRawOne(id, userId);
    const strategy = this.strategyFactory.getStrategy(connection.type);

    // Close existing pools for this connection if config changed
    for (const [key, poolData] of this.pools.entries()) {
      if (key.startsWith(`${id}:`)) {
        await strategy.closePool(poolData.pool);
        this.pools.delete(key);
      }
    }

    const { password, ...rest } = updateConnectionDto;
    const encryptedPassword = password !== undefined && password !== null ? encryptAttribute(password) : undefined;
    const readOnly =
      updateConnectionDto.readOnly !== undefined
        ? updateConnectionDto.readOnly
        : connection.readOnly;
    const dataToUpdate = {
      ...rest,
      ...(password !== undefined && password !== null ? { password: encryptedPassword } : {}),
      readOnly,
      allowSchemaChanges: readOnly ? false : (updateConnectionDto.allowSchemaChanges ?? connection.allowSchemaChanges),
      allowImportExport: readOnly ? false : (updateConnectionDto.allowImportExport ?? connection.allowImportExport),
      allowQueryExecution: updateConnectionDto.allowQueryExecution ?? connection.allowQueryExecution,
    };

    const updatedConnection = await this.prisma.connection.update({
      where: { id },
      data: dataToUpdate,
    });

    if (updateConnectionDto.organizationId && updateConnectionDto.organizationId !== connection.organizationId) {
        await this.auditService.log({
            action: AuditAction.TEAM_RESOURCE_SHARE,
            userId,
            organizationId: updateConnectionDto.organizationId,
            details: { resourceType: 'CONNECTION', resourceId: id, resourceName: updatedConnection.name }
        });
    }

    const safeConnection = this.sanitizeConnection(updatedConnection);
    return safeConnection as unknown as Connection;
  }

  async remove(id: string, userId: string): Promise<void> {
    const connection = await this.findRawOne(id, userId);
    const strategy = this.strategyFactory.getStrategy(connection.type);

    // Close pools
    for (const [key, poolData] of this.pools.entries()) {
      if (key.startsWith(`${id}:`)) {
        await strategy.closePool(poolData.pool);
        this.pools.delete(key);
      }
    }

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
    const poolData = this.pools.get(poolKey);
    if (poolData) {
      const id = poolKey.split(':')[0];
      try {
        const connection = await this.prisma.connection.findUnique({ where: { id } });
        if (connection) {
          const strategy = this.strategyFactory.getStrategy(connection.type);
          await strategy.closePool(poolData.pool);
        } else {
          if (typeof poolData.pool.end === 'function') await poolData.pool.end();
          if (typeof poolData.pool.close === 'function') await poolData.pool.close();
        }
      } catch (err) {
        // generic fallback close if connection doesn't exist anymore
        if (typeof poolData.pool.end === 'function') await poolData.pool.end();
        if (typeof poolData.pool.close === 'function') await poolData.pool.close();
      } finally {
        this.pools.delete(poolKey);
      }
    }
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
        error: error instanceof Error ? error.message : 'Connection failed',
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
