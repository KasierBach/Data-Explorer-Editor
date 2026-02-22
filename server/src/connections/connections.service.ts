import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { CreateConnectionDto } from './dto/create-connection.dto';
import { UpdateConnectionDto } from './dto/update-connection.dto';
import { Connection } from './entities/connection.entity';
import { Pool } from 'pg';
import * as mysql from 'mysql2/promise';
import * as mssql from 'mssql';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConnectionsService implements OnModuleDestroy {
  private pools = new Map<string, any>();

  constructor(private prisma: PrismaService) { }

  async onModuleDestroy() {
    for (const pool of this.pools.values()) {
      if (typeof pool.close === 'function') {
        await pool.close(); // mssql
      } else {
        await pool.end(); // pg, mysql
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

    let pool: any;
    if (connection.type === 'postgres') {
      pool = new Pool({
        host: connection.host,
        port: connection.port,
        user: connection.username,
        password: connection.password,
        database: databaseOverride || connection.database,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });
    } else if (connection.type === 'mysql') {
      pool = mysql.createPool({
        host: connection.host,
        port: connection.port,
        user: connection.username,
        password: connection.password,
        database: databaseOverride || connection.database,
        waitForConnections: true,
        connectionLimit: 20,
        queueLimit: 0,
      });
    } else if (connection.type === 'mssql') {
      const config: mssql.config = {
        server: connection.host || 'localhost',
        port: connection.port || 1433,
        user: connection.username,
        password: connection.password,
        database: databaseOverride || connection.database,
        options: {
          encrypt: false,
          trustServerCertificate: true,
        },
        pool: {
          max: 20,
          min: 0,
          idleTimeoutMillis: 30000,
        },
      };
      pool = await new mssql.ConnectionPool(config).connect();
    }

    this.pools.set(poolKey, pool);
    return pool;
  }

  async update(id: string, updateConnectionDto: UpdateConnectionDto): Promise<Connection> {
    await this.findOne(id);

    // Close existing pools for this connection if config changed
    for (const [key, pool] of this.pools.entries()) {
      if (key.startsWith(`${id}:`)) {
        if (typeof pool.close === 'function') {
          await pool.close();
        } else {
          await pool.end();
        }
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
    await this.findOne(id);

    // Close pools
    for (const [key, pool] of this.pools.entries()) {
      if (key.startsWith(`${id}:`)) {
        if (typeof pool.close === 'function') {
          await pool.close();
        } else {
          await pool.end();
        }
        this.pools.delete(key);
      }
    }

    await this.prisma.connection.delete({
      where: { id },
    });
  }
}
