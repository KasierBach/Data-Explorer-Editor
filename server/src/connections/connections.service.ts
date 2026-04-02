import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { CreateConnectionDto } from './dto/create-connection.dto';
import { UpdateConnectionDto } from './dto/update-connection.dto';
import { Connection } from './entities/connection.entity';
import { PrismaService } from '../prisma/prisma.service';
import { DatabaseStrategyFactory } from '../database-strategies/strategy.factory';
import { encryptAttribute, decryptAttribute } from '../utils/crypto.util';
import { AuditService, AuditAction } from '../audit/audit.service';

@Injectable()
export class ConnectionsService implements OnModuleDestroy {
  private pools = new Map<string, { pool: any; lastAccessed: number }>();
  private readonly POOL_TTL = 15 * 60 * 1000; // 15 mins
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(
    private prisma: PrismaService,
    private strategyFactory: DatabaseStrategyFactory,
    private auditService: AuditService,
  ) {
    // Run cleanup every minute
    this.cleanupInterval = setInterval(() => this.cleanupPools(), 60000);
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
          console.error(`Error closing idle pool ${key}:`, err);
        } finally {
          this.pools.delete(key);
          console.log(`Cleaned up idle pool: ${key}`);
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
    const { name, password, ...rest } = createConnectionDto;
    const encryptedPassword = password ? encryptAttribute(password) : undefined;

    const connection = await this.prisma.connection.create({
      data: { ...createConnectionDto, password: encryptedPassword, userId } as any,
    });
    const { password: _, ...safeConnection } = connection;

    await this.auditService.log({
      action: AuditAction.DB_CONNECTION_CREATE,
      userId,
      details: { name: connection.name, type: connection.type, database: connection.database }
    });

    return safeConnection as unknown as Connection;
  }

  async findAll(userId: string): Promise<Connection[]> {
    const connections = await this.prisma.connection.findMany({ where: { userId } });
    return connections.map(c => {
      const { password: _, ...safe } = c;
      return safe;
    }) as unknown as Connection[];
  }

  private async findRawOne(id: string, userId: string) {
    const connection = await this.prisma.connection.findFirst({
      where: { id, userId },
    });
    if (!connection) {
      throw new NotFoundException(`Connection with ID ${id} not found or you don't have permission`);
    }
    return connection;
  }

  async findOne(id: string, userId: string): Promise<Connection> {
    const connection = await this.findRawOne(id, userId);
    const { password: _, ...safeConnection } = connection;
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
    const connectionWithDecryptedPassword = { ...connection, password: decryptedPassword };

    const strategy = this.strategyFactory.getStrategy(connection.type);
    const pool = await strategy.createPool(connectionWithDecryptedPassword, databaseOverride);

    this.pools.set(poolKey, { pool, lastAccessed: Date.now() });
    return pool;
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
    const dataToUpdate = password !== undefined && password !== null ? { ...rest, password: encryptedPassword } : rest;

    const updatedConnection = await this.prisma.connection.update({
      where: { id },
      data: dataToUpdate,
    });

    const { password: _, ...safeConnection } = updatedConnection;
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
}
