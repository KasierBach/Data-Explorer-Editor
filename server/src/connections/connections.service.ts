import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { CreateConnectionDto } from './dto/create-connection.dto';
import { UpdateConnectionDto } from './dto/update-connection.dto';
import { Connection } from './entities/connection.entity';
import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'pg';
import * as mysql from 'mysql2/promise';

@Injectable()
export class ConnectionsService implements OnModuleDestroy {
  private connections: Connection[] = [];
  private pools = new Map<string, any>();

  async onModuleDestroy() {
    for (const pool of this.pools.values()) {
      await pool.end();
    }
  }

  create(createConnectionDto: CreateConnectionDto): Connection {
    const newConnection: Connection = {
      id: uuidv4(),
      ...createConnectionDto,
      createdAt: new Date(),
    };
    this.connections.push(newConnection);
    return newConnection;
  }

  findAll(): Connection[] {
    return this.connections;
  }

  findOne(id: string): Connection {
    const connection = this.connections.find(c => c.id === id);
    if (!connection) {
      throw new NotFoundException(`Connection with ID ${id} not found`);
    }
    return connection;
  }

  async getPool(id: string, databaseOverride?: string) {
    const connection = this.findOne(id);
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
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
    } else if (connection.type === 'mysql') {
      pool = mysql.createPool({
        host: connection.host,
        port: connection.port,
        user: connection.username,
        password: connection.password,
        database: databaseOverride || connection.database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });
    }

    this.pools.set(poolKey, pool);
    return pool;
  }

  update(id: string, updateConnectionDto: UpdateConnectionDto): Connection {
    const index = this.connections.findIndex(c => c.id === id);
    if (index === -1) {
      throw new NotFoundException(`Connection with ID ${id} not found`);
    }

    // Close existing pools for this connection if config changed
    for (const [key, pool] of this.pools.entries()) {
      if (key.startsWith(`${id}:`)) {
        pool.end();
        this.pools.delete(key);
      }
    }

    const updatedConnection = {
      ...this.connections[index],
      ...updateConnectionDto,
    };

    this.connections[index] = updatedConnection;
    return updatedConnection;
  }

  remove(id: string): void {
    const index = this.connections.findIndex(c => c.id === id);
    if (index === -1) {
      throw new NotFoundException(`Connection with ID ${id} not found`);
    }

    // Close pools
    for (const [key, pool] of this.pools.entries()) {
      if (key.startsWith(`${id}:`)) {
        pool.end();
        this.pools.delete(key);
      }
    }

    this.connections.splice(index, 1);
  }
}
