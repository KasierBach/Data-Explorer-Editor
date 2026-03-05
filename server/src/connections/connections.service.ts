import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { CreateConnectionDto } from './dto/create-connection.dto';
import { UpdateConnectionDto } from './dto/update-connection.dto';
import { Connection } from './entities/connection.entity';
import { PrismaService } from '../prisma/prisma.service';
import { DatabaseStrategyFactory } from '../database-strategies/strategy.factory';
import { encryptAttribute, decryptAttribute } from '../utils/crypto.util';

@Injectable()
export class ConnectionsService implements OnModuleDestroy {
  private pools = new Map<string, any>();

  constructor(
    private prisma: PrismaService,
    private strategyFactory: DatabaseStrategyFactory,
  ) { }

  async onModuleDestroy() {
    for (const [key, pool] of this.pools.entries()) {
      const id = key.split(':')[0];
      const connection = await this.prisma.connection.findUnique({ where: { id } });
      if (connection) {
        const strategy = this.strategyFactory.getStrategy(connection.type);
        await strategy.closePool(pool);
      }
    }
  }

  async create(createConnectionDto: CreateConnectionDto): Promise<Connection> {
    const { name, password, ...rest } = createConnectionDto;
    const encryptedPassword = password ? encryptAttribute(password) : undefined;

    const connection = await this.prisma.connection.upsert({
      where: { name } as any,
      update: { ...rest, password: encryptedPassword } as any,
      create: { ...createConnectionDto, password: encryptedPassword } as any,
    });
    const { password: _, ...safeConnection } = connection;
    return safeConnection as unknown as Connection;
  }

  async findAll(): Promise<Connection[]> {
    const connections = await this.prisma.connection.findMany();
    return connections.map(c => {
      const { password: _, ...safe } = c;
      return safe;
    }) as unknown as Connection[];
  }

  private async findRawOne(id: string) {
    const connection = await this.prisma.connection.findUnique({
      where: { id },
    });
    if (!connection) {
      throw new NotFoundException(`Connection with ID ${id} not found`);
    }
    return connection;
  }

  async findOne(id: string): Promise<Connection> {
    const connection = await this.findRawOne(id);
    const { password: _, ...safeConnection } = connection;
    return safeConnection as unknown as Connection;
  }

  async getPool(id: string, databaseOverride?: string) {
    const connection = await this.findRawOne(id);
    const poolKey = `${id}:${databaseOverride || connection.database}`;

    if (this.pools.has(poolKey)) {
      return this.pools.get(poolKey);
    }

    const decryptedPassword = connection.password ? decryptAttribute(connection.password) : undefined;
    const connectionWithDecryptedPassword = { ...connection, password: decryptedPassword };

    const strategy = this.strategyFactory.getStrategy(connection.type);
    const pool = await strategy.createPool(connectionWithDecryptedPassword, databaseOverride);

    this.pools.set(poolKey, pool);
    return pool;
  }

  async update(id: string, updateConnectionDto: UpdateConnectionDto): Promise<Connection> {
    const connection = await this.findRawOne(id);
    const strategy = this.strategyFactory.getStrategy(connection.type);

    // Close existing pools for this connection if config changed
    for (const [key, pool] of this.pools.entries()) {
      if (key.startsWith(`${id}:`)) {
        await strategy.closePool(pool);
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

  async remove(id: string): Promise<void> {
    const connection = await this.findRawOne(id);
    const strategy = this.strategyFactory.getStrategy(connection.type);

    // Close pools
    for (const [key, pool] of this.pools.entries()) {
      if (key.startsWith(`${id}:`)) {
        await strategy.closePool(pool);
        this.pools.delete(key);
      }
    }

    await this.prisma.connection.delete({
      where: { id },
    });
  }
}
