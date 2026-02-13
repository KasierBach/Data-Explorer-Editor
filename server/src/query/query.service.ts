import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { CreateQueryDto } from './dto/create-query.dto';
import { ConnectionsService } from '../connections/connections.service';
import { Client } from 'pg';
import * as mysql from 'mysql2/promise';

@Injectable()
export class QueryService {
  constructor(private readonly connectionsService: ConnectionsService) { }

  async executeQuery(createQueryDto: CreateQueryDto) {
    const { connectionId, sql, database } = createQueryDto;
    const connection = await this.connectionsService.findOne(connectionId);

    try {
      const pool = await this.connectionsService.getPool(connectionId, database);

      if (connection.type === 'postgres') {
        const client = await pool.connect();
        try {
          const result = await client.query(sql);
          const queryResult = Array.isArray(result) ? result[result.length - 1] : result;
          return {
            rows: queryResult.rows || [],
            columns: queryResult.fields ? queryResult.fields.map(f => f.name) : [],
            rowCount: queryResult.rowCount
          };
        } finally {
          client.release();
        }
      } else if (connection.type === 'mysql') {
        const [rows, fields] = await pool.execute(sql);
        return {
          rows,
          columns: (fields as any[]).map(f => f.name),
        };
      } else if (connection.type === 'mssql') {
        const result = await pool.request().query(sql);
        return {
          rows: result.recordset || [],
          columns: result.recordset?.columns ? Object.keys(result.recordset.columns) : [],
          rowCount: result.rowsAffected?.[0] ?? 0,
        };
      } else {
        throw new BadRequestException(`Unsupported connection type: ${connection.type}`);
      }
    } catch (error) {
      console.error('Query Service Error:', error);
      throw new InternalServerErrorException(`Query execution failed: ${error.message}`);
    }
  }

  async updateRow(updateRowDto: any) {
    const { connectionId, database, schema, table, pkColumn, pkValue, updates } = updateRowDto;
    const connection = await this.connectionsService.findOne(connectionId);

    const updateCols = Object.keys(updates);
    if (updateCols.length === 0) return { success: true, message: 'No changes' };

    const pool = await this.connectionsService.getPool(connectionId, database);

    try {
      if (connection.type === 'postgres') {
        const quotedTable = schema ? `"${schema}"."${table}"` : `"${table}"`;
        const setClause = updateCols.map((col, i) => `"${col}" = $${i + 1}`).join(', ');
        const sql = `UPDATE ${quotedTable} SET ${setClause} WHERE "${pkColumn}" = $${updateCols.length + 1}`;
        const values = [...updateCols.map(c => updates[c]), pkValue];

        const res = await pool.query(sql, values);
        return { success: true, rowCount: res.rowCount };
      } else if (connection.type === 'mysql') {
        const mysqlTable = `\`${table}\``;
        const setClause = updateCols.map(col => `\`${col}\` = ?`).join(', ');
        const sql = `UPDATE ${mysqlTable} SET ${setClause} WHERE \`${pkColumn}\` = ?`;
        const values = [...updateCols.map(c => updates[c]), pkValue];

        const [result] = await pool.execute(sql, values);
        return { success: true, rowCount: (result as any).affectedRows };
      } else if (connection.type === 'mssql') {
        const mssqlTable = schema ? `[${schema}].[${table}]` : `[${table}]`;
        const setClause = updateCols.map((col, i) => `[${col}] = @p${i}`).join(', ');
        const sql = `UPDATE ${mssqlTable} SET ${setClause} WHERE [${pkColumn}] = @pk`;
        const request = pool.request();
        updateCols.forEach((col, i) => request.input(`p${i}`, updates[col]));
        request.input('pk', pkValue);
        const result = await request.query(sql);
        return { success: true, rowCount: result.rowsAffected?.[0] ?? 0 };
      }
    } catch (error) {
      console.error('Update Row Error:', error);
      throw new InternalServerErrorException(`Update failed: ${error.message}`);
    }
  }

  async updateSchema(updateSchemaDto: any) {
    const { connectionId, database, schema, table, operations } = updateSchemaDto;
    const connection = await this.connectionsService.findOne(connectionId);
    if (!connection) throw new BadRequestException('Invalid connection ID');

    const quotedTable = connection.type === 'postgres'
      ? (schema ? `"${schema}"."${table}"` : `"${table}"`)
      : connection.type === 'mssql'
        ? (schema ? `[${schema}].[${table}]` : `[${table}]`)
        : `\`${table}\``;

    const sqlStatements: string[] = [];

    for (const op of operations) {
      switch (op.type) {
        case 'add_column': {
          const colQuote = connection.type === 'postgres' ? `"${op.name}"` : connection.type === 'mssql' ? `[${op.name}]` : `\`${op.name}\``;
          sqlStatements.push(`ALTER TABLE ${quotedTable} ADD ${connection.type === 'mssql' ? '' : 'COLUMN '}${colQuote} ${op.dataType} ${op.isNullable === false ? 'NOT NULL' : ''}`);
          break;
        }
        case 'drop_column': {
          const colQuote = connection.type === 'postgres' ? `"${op.name}"` : connection.type === 'mssql' ? `[${op.name}]` : `\`${op.name}\``;
          sqlStatements.push(`ALTER TABLE ${quotedTable} DROP COLUMN ${colQuote}`);
          break;
        }
        case 'alter_column_type':
          if (connection.type === 'postgres') {
            sqlStatements.push(`ALTER TABLE ${quotedTable} ALTER COLUMN "${op.name}" TYPE ${op.newType}`);
          } else if (connection.type === 'mssql') {
            sqlStatements.push(`ALTER TABLE ${quotedTable} ALTER COLUMN [${op.name}] ${op.newType}`);
          } else {
            sqlStatements.push(`ALTER TABLE ${quotedTable} MODIFY COLUMN \`${op.name}\` ${op.newType}`);
          }
          break;
        case 'rename_column':
          if (connection.type === 'postgres') {
            sqlStatements.push(`ALTER TABLE ${quotedTable} RENAME COLUMN "${op.name}" TO "${op.newName}"`);
          } else if (connection.type === 'mssql') {
            sqlStatements.push(`EXEC sp_rename '${schema ? schema + '.' : ''}${table}.${op.name}', '${op.newName}', 'COLUMN'`);
          } else {
            sqlStatements.push(`ALTER TABLE ${quotedTable} RENAME COLUMN \`${op.name}\` TO \`${op.newName}\``);
          }
          break;
        case 'add_pk': {
          const pkCols = op.columns.map(c => connection.type === 'postgres' ? `"${c}"` : connection.type === 'mssql' ? `[${c}]` : `\`${c}\``).join(', ');
          sqlStatements.push(`ALTER TABLE ${quotedTable} ADD PRIMARY KEY (${pkCols})`);
          break;
        }
        case 'drop_pk':
          sqlStatements.push(`ALTER TABLE ${quotedTable} DROP PRIMARY KEY`);
          break;
        case 'add_fk': {
          const fkCols = op.columns.map(c => connection.type === 'postgres' ? `"${c}"` : connection.type === 'mssql' ? `[${c}]` : `\`${c}\``).join(', ');
          const refCols = op.refColumns.map(c => connection.type === 'postgres' ? `"${c}"` : connection.type === 'mssql' ? `[${c}]` : `\`${c}\``).join(', ');
          const refTable = connection.type === 'postgres' ? `"${op.refTable}"` : connection.type === 'mssql' ? `[${op.refTable}]` : `\`${op.refTable}\``;
          sqlStatements.push(`ALTER TABLE ${quotedTable} ADD CONSTRAINT ${op.name} FOREIGN KEY (${fkCols}) REFERENCES ${refTable} (${refCols})`);
          break;
        }
        case 'drop_fk':
          if (connection.type === 'postgres' || connection.type === 'mssql') {
            const q = connection.type === 'postgres' ? `"${op.name}"` : `[${op.name}]`;
            sqlStatements.push(`ALTER TABLE ${quotedTable} DROP CONSTRAINT ${q}`);
          } else {
            sqlStatements.push(`ALTER TABLE ${quotedTable} DROP FOREIGN KEY \`${op.name}\``);
          }
          break;
      }
    }

    try {
      const results: any[] = [];
      for (const sql of sqlStatements) {
        // We reuse executeQuery for simplicity, or we can run them in a transaction
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

    // Basic validation to prevent SQL injection (alphanumeric + underscores/hyphens only)
    if (!/^[a-zA-Z0-9_-]+$/.test(databaseName)) {
      throw new BadRequestException('Invalid database name. Only alphanumeric characters, underscores, and hyphens are allowed.');
    }

    try {
      // Connect to the default database for the connection to execute CREATE DATABASE
      // We don't use the 'database' parameter in getPool because we might not want to connect to a specific DB yet,
      // or we want to connect to the default one to create a NEW one.
      const pool = await this.connectionsService.getPool(connectionId);

      let sql = '';
      if (connection.type === 'postgres') {
        sql = `CREATE DATABASE "${databaseName}"`;
        // Postgres cannot run CREATE DATABASE inside a transaction block, which executeQuery might imply if using a single client.
        // However, our executeQuery uses a pool which gives a client. pool.query is fine.
        await pool.query(sql);
      } else if (connection.type === 'mysql') {
        sql = `CREATE DATABASE \`${databaseName}\``;
        await pool.execute(sql);
      } else if (connection.type === 'mssql') {
        sql = `CREATE DATABASE [${databaseName}]`;
        await pool.request().query(sql);
      } else {
        throw new BadRequestException(`Unsupported connection type: ${connection.type}`);
      }

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

      if (connection.type === 'postgres') {
        // Terminate other connections first
        await pool.query(`
                SELECT pg_terminate_backend(pid) 
                FROM pg_stat_activity 
                WHERE datname = $1 AND pid <> pg_backend_pid()
            `, [databaseName]);
        await pool.query(`DROP DATABASE "${databaseName}"`);
      } else if (connection.type === 'mysql') {
        await pool.execute(`DROP DATABASE \`${databaseName}\``);
      } else if (connection.type === 'mssql') {
        // Set to single user to rollback other connections
        await pool.request().query(`ALTER DATABASE [${databaseName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE`);
        await pool.request().query(`DROP DATABASE [${databaseName}]`);
      } else {
        throw new BadRequestException(`Unsupported connection type: ${connection.type}`);
      }

      return { success: true, message: `Database ${databaseName} dropped successfully.` };
    } catch (error) {
      console.error('Drop Database Error:', error);
      throw new InternalServerErrorException(`Failed to drop database: ${error.message}`);
    }
  }
}
