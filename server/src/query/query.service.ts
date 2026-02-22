import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { CreateQueryDto } from './dto/create-query.dto';
import { ConnectionsService } from '../connections/connections.service';
import { DatabaseStrategyFactory } from '../database-strategies';

@Injectable()
export class QueryService {
  constructor(
    private readonly connectionsService: ConnectionsService,
    private readonly strategyFactory: DatabaseStrategyFactory,
  ) { }

  async executeQuery(createQueryDto: CreateQueryDto) {
    const { connectionId, sql, database } = createQueryDto;
    const connection = await this.connectionsService.findOne(connectionId);

    try {
      const pool = await this.connectionsService.getPool(connectionId, database);
      const strategy = this.strategyFactory.getStrategy(connection.type);
      return strategy.executeQuery(pool, sql);
    } catch (error) {
      console.error('Query Service Error:', error);
      throw new InternalServerErrorException(`Query execution failed: ${error.message}`);
    }
  }

  async updateRow(updateRowDto: {
    connectionId: string;
    database?: string;
    schema: string;
    table: string;
    pkColumn: string;
    pkValue: any;
    updates: Record<string, any>;
  }) {
    const { connectionId, database, schema, table, pkColumn, pkValue, updates } = updateRowDto;
    const connection = await this.connectionsService.findOne(connectionId);

    const updateCols = Object.keys(updates);
    if (updateCols.length === 0) return { success: true, message: 'No changes' };

    try {
      const pool = await this.connectionsService.getPool(connectionId, database);
      const strategy = this.strategyFactory.getStrategy(connection.type);
      return strategy.updateRow(pool, { schema, table, pkColumn, pkValue, updates });
    } catch (error) {
      console.error('Update Row Error:', error);
      throw new InternalServerErrorException(`Update failed: ${error.message}`);
    }
  }

  async updateSchema(updateSchemaDto: {
    connectionId: string;
    database?: string;
    schema: string;
    table: string;
    operations: any[];
  }) {
    const { connectionId, database, schema, table, operations } = updateSchemaDto;
    const connection = await this.connectionsService.findOne(connectionId);
    if (!connection) throw new BadRequestException('Invalid connection ID');

    const strategy = this.strategyFactory.getStrategy(connection.type);
    const quotedTable = strategy.quoteTable(schema, table);

    const sqlStatements: string[] = [];
    for (const op of operations) {
      const sql = strategy.buildAlterTableSql(quotedTable, op);
      if (sql) sqlStatements.push(sql);
    }

    try {
      const results: any[] = [];
      for (const sql of sqlStatements) {
        results.push(await this.executeQuery({ connectionId, sql, database }));
      }
      return { success: true, results };
    } catch (error) {
      console.error('Update Schema Error:', error);
      throw new InternalServerErrorException(`Schema update failed: ${error.message}`);
    }
  }

  async seedData(connectionId: string) {
    const sql = `
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100),
                email VARCHAR(100) UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100),
                price DECIMAL(10, 2),
                stock INT
            );
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id),
                total DECIMAL(10, 2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            INSERT INTO users (name, email) VALUES 
            ('Alice Johnson', 'alice@example.com'),
            ('Bob Smith', 'bob@example.com'),
            ('Charlie Brown', 'charlie@example.com')
            ON CONFLICT DO NOTHING;
            INSERT INTO products (name, price, stock) VALUES 
            ('Laptop', 999.99, 10),
            ('Mouse', 25.50, 100),
            ('Keyboard', 50.00, 50)
            ON CONFLICT DO NOTHING;
            INSERT INTO orders (user_id, total) VALUES 
            (1, 1025.49),
            (2, 25.50)
            ON CONFLICT DO NOTHING;
        `;
    return this.executeQuery({ connectionId, sql });
  }

  async createDatabase(connectionId: string, databaseName: string) {
    const connection = await this.connectionsService.findOne(connectionId);
    if (!connection) throw new BadRequestException('Invalid connection ID');

    if (!/^[a-zA-Z0-9_-]+$/.test(databaseName)) {
      throw new BadRequestException('Invalid database name. Only alphanumeric characters, underscores, and hyphens are allowed.');
    }

    try {
      const pool = await this.connectionsService.getPool(connectionId);
      const strategy = this.strategyFactory.getStrategy(connection.type);
      await strategy.createDatabase(pool, databaseName);
      return { success: true, message: `Database ${databaseName} created successfully.` };
    } catch (error) {
      console.error('Create Database Error:', error);
      throw new InternalServerErrorException(`Failed to create database: ${error.message}`);
    }
  }

  async dropDatabase(connectionId: string, databaseName: string) {
    const connection = await this.connectionsService.findOne(connectionId);
    if (!connection) throw new BadRequestException('Invalid connection ID');

    if (!/^[a-zA-Z0-9_-]+$/.test(databaseName)) {
      throw new BadRequestException('Invalid database name.');
    }

    try {
      const pool = await this.connectionsService.getPool(connectionId);
      const strategy = this.strategyFactory.getStrategy(connection.type);
      await strategy.dropDatabase(pool, databaseName);
      return { success: true, message: `Database ${databaseName} dropped successfully.` };
    } catch (error) {
      console.error('Drop Database Error:', error);
      throw new InternalServerErrorException(`Failed to drop database: ${error.message}`);
    }
  }
}
