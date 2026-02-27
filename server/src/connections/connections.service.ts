import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { CreateConnectionDto } from './dto/create-connection.dto';
import { UpdateConnectionDto } from './dto/update-connection.dto';
import { Connection } from './entities/connection.entity';
import { PrismaService } from '../prisma/prisma.service';
import { DatabaseStrategyFactory } from '../database-strategies/strategy.factory';

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
    const { name, ...rest } = createConnectionDto;
    const connection = await this.prisma.connection.upsert({
      where: { name } as any,
      update: rest as any,
      create: createConnectionDto as any,
    });
    return connection as unknown as Connection;
  }

  async findAll(): Promise<Connection[]> {
    const connections = await this.prisma.connection.findMany();
    return connections as unknown as Connection[];
  }

  async findOne(id: string): Promise<Connection> {
    const connection = await this.prisma.connection.findUnique({
      where: { id },
    });
    if (!connection) {
      throw new NotFoundException(`Connection with ID ${id} not found`);
    }
    return connection as unknown as Connection;
  }

  async getPool(id: string, databaseOverride?: string) {
    const connection = await this.findOne(id);
    const poolKey = `${id}:${databaseOverride || connection.database}`;

    if (this.pools.has(poolKey)) {
      return this.pools.get(poolKey);
    }

    const strategy = this.strategyFactory.getStrategy(connection.type);
    const pool = await strategy.createPool(connection, databaseOverride);

    this.pools.set(poolKey, pool);
    return pool;
  }

  async update(id: string, updateConnectionDto: UpdateConnectionDto): Promise<Connection> {
    const connection = await this.findOne(id);
    const strategy = this.strategyFactory.getStrategy(connection.type);

    // Close existing pools for this connection if config changed
    for (const [key, pool] of this.pools.entries()) {
      if (key.startsWith(`${id}:`)) {
        await strategy.closePool(pool);
        this.pools.delete(key);
      }
    }

    const updatedConnection = await this.prisma.connection.update({
      where: { id },
      data: updateConnectionDto,
    });

    return updatedConnection as unknown as Connection;
  }

  async remove(id: string): Promise<void> {
    const connection = await this.findOne(id);
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
