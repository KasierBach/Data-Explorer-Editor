import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { CreateQueryDto } from './dto/create-query.dto';
import { UpdateRowDto } from './dto/update-row.dto';
import { InsertRowDto } from './dto/insert-row.dto';
import { DeleteRowsDto } from './dto/delete-rows.dto';
import { UpdateSchemaDto } from './dto/update-schema.dto';
import { ConnectionsService } from '../connections/connections.service';
import { DatabaseStrategyFactory } from '../database-strategies';
import { AuditService, AuditAction } from '../audit/audit.service';

@Injectable()
export class QueryService {
  constructor(
    private readonly connectionsService: ConnectionsService,
    private readonly strategyFactory: DatabaseStrategyFactory,
    private readonly auditService: AuditService,
  ) { }

  async executeQuery(createQueryDto: CreateQueryDto, userId: string) {
    const { connectionId, sql, database, limit, offset } = createQueryDto;
    const connection = await this.connectionsService.findOne(connectionId, userId);

    try {
      const pool = await this.connectionsService.getPool(connectionId, database || connection.database, userId);
      const strategy = this.strategyFactory.getStrategy(connection.type);
      
      const result = await strategy.executeQuery(pool, sql, { limit, offset });

      // Attempt to get totalCount for table views (standard SELECT * queries)
      if (sql.trim().toUpperCase().startsWith('SELECT * FROM')) {
        try {
          const match = sql.match(/FROM\s+([\w"`.\[\]]+)/i);
          if (match) {
            const tableRef = match[1];
            const countSql = connection.type === 'mongodb' 
              ? JSON.stringify({ action: 'count', collection: tableRef.replace(/['"`]/g, '') })
              : `SELECT COUNT(*) as total FROM ${tableRef}`;
            
            const countResult = await strategy.executeQuery(pool, countSql);
            if (countResult.rows && countResult.rows.length > 0) {
              // Extract count from various possible column names (total, TOTAL, count, or the first field)
              const firstRow = countResult.rows[0];
              const countVal = firstRow.total ?? firstRow.TOTAL ?? firstRow.count ?? firstRow[Object.keys(firstRow)[0]];
              result.totalCount = parseInt(countVal, 10);
            }
          }
        } catch (countError) {
          console.warn('Failed to fetch total row count:', countError.message);
        }
      }

      await this.auditService.log({
        action: AuditAction.DB_QUERY_EXECUTE,
        userId,
        details: { 
          connectionId, 
          database: database || connection.database, 
          sqlSnippet: sql.substring(0, 100) + (sql.length > 100 ? '...' : '') 
        }
      });

      return result;
    } catch (error) {
      console.error('Query Service Error:', error);
      throw new InternalServerErrorException(`Query execution failed: ${error.message}`);
    }
  }

  async updateRow(updateRowDto: UpdateRowDto, userId: string) {
    const { connectionId, database, schema, table, pkColumn, pkValue, updates } = updateRowDto;
    const connection = await this.connectionsService.findOne(connectionId, userId);

    const updateCols = Object.keys(updates);
    if (updateCols.length === 0) return { success: true, message: 'No changes' };

    try {
      const pool = await this.connectionsService.getPool(connectionId, database, userId);
      const strategy = this.strategyFactory.getStrategy(connection.type);
      return await strategy.updateRow(pool, { schema, table, pkColumn, pkValue, updates });
    } catch (error) {
      console.error('Update Row Error:', error);
      throw new InternalServerErrorException(`Update failed: ${error.message}`);
    }
  }

  async insertRow(insertRowDto: InsertRowDto, userId: string) {
    const { connectionId, database, schema, table, data } = insertRowDto;
    const connection = await this.connectionsService.findOne(connectionId, userId);

    try {
      const pool = await this.connectionsService.getPool(connectionId, database || connection.database, userId);
      const strategy = this.strategyFactory.getStrategy(connection.type);
      return await strategy.insertRow(pool, { schema, table, data });
    } catch (error) {
      console.error('Insert Row Error:', error);
      throw new InternalServerErrorException(`Insert failed: ${error.message}`);
    }
  }

  async deleteRows(deleteRowsDto: DeleteRowsDto, userId: string) {
    const { connectionId, database, schema, table, pkColumn, pkValues } = deleteRowsDto;
    const connection = await this.connectionsService.findOne(connectionId, userId);

    try {
      const pool = await this.connectionsService.getPool(connectionId, database || connection.database, userId);
      const strategy = this.strategyFactory.getStrategy(connection.type);
      return await strategy.deleteRows(pool, { schema, table, pkColumn, pkValues });
    } catch (error) {
      console.error('Delete Rows Error:', error);
      throw new InternalServerErrorException(`Delete failed: ${error.message}`);
    }
  }

  async updateSchema(updateSchemaDto: UpdateSchemaDto, userId: string) {
    const { connectionId, database, schema, table, operations } = updateSchemaDto;
    const connection = await this.connectionsService.findOne(connectionId, userId);
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
        results.push(await this.executeQuery({ connectionId, sql, database }, userId));
      }
      await this.auditService.log({
        action: AuditAction.DB_QUERY_EXECUTE,
        userId,
        details: { 
          connectionId, 
          database, 
          schema, 
          table, 
          operations: operations.map(op => op.type) 
        }
      });

      return { success: true, results };
    } catch (error) {
      console.error('Update Schema Error:', error);
      throw new InternalServerErrorException(`Schema update failed: ${error.message}`);
    }
  }

    async seedData(connectionId: string, userId: string) {
        const connection = await this.connectionsService.findOne(connectionId, userId);

        try {
            const pool = await this.connectionsService.getPool(connectionId, undefined, userId);
            const strategy = this.strategyFactory.getStrategy(connection.type);
            return await strategy.seedData(pool);
        } catch (error) {
            console.error('Seed Data Error:', error);
            throw new InternalServerErrorException(`Seed data failed: ${error.message}`);
        }
    }

  async createDatabase(connectionId: string, databaseName: string, userId: string) {
    const connection = await this.connectionsService.findOne(connectionId, userId);
    if (!connection) throw new BadRequestException('Invalid connection ID');

    if (!/^[a-zA-Z0-9_-]+$/.test(databaseName)) {
      throw new BadRequestException('Invalid database name. Only alphanumeric characters, underscores, and hyphens are allowed.');
    }

    try {
      const pool = await this.connectionsService.getPool(connectionId, undefined, userId);
      const strategy = this.strategyFactory.getStrategy(connection.type);
      await strategy.createDatabase(pool, databaseName);
      return { success: true, message: `Database ${databaseName} created successfully.` };
    } catch (error) {
      console.error('Create Database Error:', error);
      throw new InternalServerErrorException(`Failed to create database: ${error.message}`);
    }
  }

  async dropDatabase(connectionId: string, databaseName: string, userId: string) {
    const connection = await this.connectionsService.findOne(connectionId, userId);
    if (!connection) throw new BadRequestException('Invalid connection ID');

    if (!/^[a-zA-Z0-9_-]+$/.test(databaseName)) {
      throw new BadRequestException('Invalid database name.');
    }

    // For Postgres: must connect to a DIFFERENT database to drop another
    // Use the connection's default database, or fall back to 'postgres'
    const adminDb = (connection.database && connection.database !== databaseName)
      ? connection.database
      : (connection.type === 'postgres' ? 'postgres' : connection.database);

    if (adminDb === databaseName) {
      throw new BadRequestException('Cannot drop the default connection database. Connect to a different database first.');
    }

    try {
      const pool = await this.connectionsService.getPool(connectionId, adminDb, userId);
      const strategy = this.strategyFactory.getStrategy(connection.type);
      await strategy.dropDatabase(pool, databaseName);

      // Clean up any cached pool for the dropped database
      const droppedPoolKey = `${connectionId}:${databaseName}`;
      await this.connectionsService.removePool(droppedPoolKey, userId);

      return { success: true, message: `Database ${databaseName} dropped successfully.` };
    } catch (error) {
      console.error('Drop Database Error:', error);
      throw new InternalServerErrorException(`Failed to drop database: ${error.message}`);
    }
  }

  async importData(body: { connectionId: string; schema: string; table: string; data: any[] }, userId: string) {
    const { connectionId, schema, table, data } = body;
    const connection = await this.connectionsService.findOne(connectionId, userId);
    if (!connection) throw new BadRequestException('Invalid connection ID');

    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new BadRequestException('No data provided for import.');
    }

    try {
      const pool = await this.connectionsService.getPool(connectionId, undefined, userId);
      const strategy = this.strategyFactory.getStrategy(connection.type);
      const result = await strategy.importData(pool, { schema, table, data });

      await this.auditService.log({
        action: AuditAction.DB_QUERY_EXECUTE,
        userId,
        details: { 
          connectionId, 
          action: 'BULK_IMPORT',
          table: `${schema ? schema + '.' : ''}${table}`, 
          rowCount: result.rowCount 
        }
      });

      return result;
    } catch (error) {
      console.error('Import Data Error:', error);
      throw new InternalServerErrorException(`Import failed: ${error.message}`);
    }
  }
}
