import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateQueryDto } from './dto/create-query.dto';
import { UpdateRowDto } from './dto/update-row.dto';
import { InsertRowDto } from './dto/insert-row.dto';
import { DeleteRowsDto } from './dto/delete-rows.dto';
import { UpdateSchemaDto } from './dto/update-schema.dto';
import { ConnectionsService } from '../connections/connections.service';
import { DatabaseStrategyFactory } from '../database-strategies';
import { AuditService, AuditAction } from '../audit/audit.service';
import {
  analyzeDestructiveSql,
  containsMultipleStatements,
  getMongoActionFromPayload,
  isMongoActionAllowedOnReadOnly,
  isSqlAllowedOnReadOnly,
} from './query-guard.util';

@Injectable()
export class QueryService {
  constructor(
    private readonly connectionsService: ConnectionsService,
    private readonly strategyFactory: DatabaseStrategyFactory,
    private readonly auditService: AuditService,
  ) { }

  // ─── Shared Permission Helpers (DRY) ───

  private async blockOperation(
    userId: string,
    details: {
      connectionId: string;
      database?: string;
      action: string;
      reason: string;
      message: string;
      sqlSnippet?: string;
      extra?: Record<string, any>;
    },
  ): Promise<never> {
    await this.auditService.log({
      action: AuditAction.DB_QUERY_BLOCKED,
      userId,
      details,
    });

    throw new ForbiddenException({
      message: details.message,
      reason: details.reason,
      action: details.action,
      details: {
        connectionId: details.connectionId,
        database: details.database,
        ...details.extra,
      },
    });
  }

  /**
   * Validates that a mutation (insert, update, delete, schema change, etc.) is permitted.
   * Centralizes the readOnly + permission flag checks that were previously duplicated.
   */
  private async assertWritePermission(
    connection: any,
    userId: string,
    action: string,
    permissionFlag: 'allowQueryExecution' | 'allowSchemaChanges' | 'allowImportExport',
    extra?: Record<string, any>,
  ): Promise<void> {
    const reasonMap = {
      allowQueryExecution: 'QUERY_EXECUTION_DISABLED',
      allowSchemaChanges: 'SCHEMA_CHANGES_DISABLED',
      allowImportExport: 'IMPORT_EXPORT_DISABLED',
    } as const;

    const messageMap = {
      allowQueryExecution: `Data ${action} is disabled for this connection.`,
      allowSchemaChanges: `Schema changes are disabled for this connection.`,
      allowImportExport: `Import/export is disabled for this connection.`,
    } as const;

    if (!connection[permissionFlag]) {
      await this.blockOperation(userId, {
        connectionId: connection.id,
        database: connection.database || undefined,
        action,
        reason: reasonMap[permissionFlag],
        message: messageMap[permissionFlag],
        extra,
      });
    }

    if (connection.readOnly) {
      await this.blockOperation(userId, {
        connectionId: connection.id,
        database: connection.database || undefined,
        action,
        reason: 'READ_ONLY_CONNECTION',
        message: `This connection is read-only. ${action} is blocked.`,
        extra,
      });
    }
  }

  // ─── Query Execution ───

  private async assertQueryAllowed(
    connection: any,
    sql: string,
    userId: string,
    database?: string,
    confirmed?: boolean,
  ) {
    // 1. Check if query execution is enabled at all
    if (!connection.allowQueryExecution) {
      await this.blockOperation(userId, {
        connectionId: connection.id,
        database,
        action: 'execute_query',
        reason: 'QUERY_EXECUTION_DISABLED',
        message: 'Query execution is disabled for this connection.',
      });
    }

    // 2. Block multi-statement SQL (prevents piggyback injection like "SELECT 1; DROP TABLE users")
    if (connection.type !== 'mongodb' && connection.type !== 'mongodb+srv') {
      if (containsMultipleStatements(sql)) {
        await this.blockOperation(userId, {
          connectionId: connection.id,
          database,
          action: 'execute_query',
          reason: 'MULTI_STATEMENT_BLOCKED',
          message: 'Multi-statement queries are not allowed. Please execute one statement at a time.',
          sqlSnippet: sql.slice(0, 120),
        });
      }
    }

    // 3. MongoDB read-only check
    if (connection.type === 'mongodb' || connection.type === 'mongodb+srv') {
      const action = getMongoActionFromPayload(sql);
      if (connection.readOnly && !isMongoActionAllowedOnReadOnly(action)) {
        await this.blockOperation(userId, {
          connectionId: connection.id,
          database,
          action: 'execute_query',
          reason: 'READ_ONLY_CONNECTION',
          message: 'This connection is read-only. Only read operations are allowed.',
          extra: { mongoAction: action },
        });
      }
      return;
    }

    // 4. Read-only connection: block all non-read queries
    if (connection.readOnly && !isSqlAllowedOnReadOnly(sql)) {
      await this.blockOperation(userId, {
        connectionId: connection.id,
        database,
        action: 'execute_query',
        reason: 'READ_ONLY_CONNECTION',
        message: 'This connection is read-only. Only read queries are allowed.',
        sqlSnippet: sql.slice(0, 120),
      });
    }

    // 5. Non-readOnly connection: detect destructive SQL and require confirmation
    if (!connection.readOnly) {
      const analysis = analyzeDestructiveSql(sql);

      if (analysis.isDestructive && !confirmed) {
        // Log the attempt
        await this.auditService.log({
          action: AuditAction.DB_QUERY_BLOCKED,
          userId,
          details: {
            connectionId: connection.id,
            database,
            action: 'execute_query',
            reason: 'DESTRUCTIVE_REQUIRES_CONFIRMATION',
            sqlSnippet: sql.slice(0, 200),
            severity: analysis.severity,
            keywords: analysis.keywords,
            affectedObject: analysis.affectedObject,
          },
        });

        // Return a structured response that the frontend will intercept
        throw new ForbiddenException({
          message: `This query contains destructive operations (${analysis.keywords.join(', ')}). Please confirm to proceed.`,
          reason: 'DESTRUCTIVE_REQUIRES_CONFIRMATION',
          action: 'execute_query',
          details: {
            requiresConfirmation: true,
            analysis: {
              severity: analysis.severity,
              keywords: analysis.keywords,
              affectedObject: analysis.affectedObject,
            },
          },
        });
      }

      // If confirmed, log it as a confirmed destructive query
      if (analysis.isDestructive && confirmed) {
        await this.auditService.log({
          action: AuditAction.DB_QUERY_DESTRUCTIVE_CONFIRMED,
          userId,
          details: {
            connectionId: connection.id,
            database,
            sqlSnippet: sql.slice(0, 200),
            severity: analysis.severity,
            keywords: analysis.keywords,
            affectedObject: analysis.affectedObject,
          },
        });
      }
    }
  }

  async executeQuery(createQueryDto: CreateQueryDto, userId: string) {
    const { connectionId, sql, database, limit, offset, confirmed } = createQueryDto;
    const connection = await this.connectionsService.findOne(connectionId, userId);
    await this.assertQueryAllowed(connection, sql, userId, database || connection.database, confirmed);

    try {
      const pool = await this.connectionsService.getPool(connectionId, database || connection.database, userId);
      const strategy = this.strategyFactory.getStrategy(connection.type);
      
      const result = await strategy.executeQuery(pool, sql, { limit, offset });

      // Attempt to get totalCount for table views (standard SELECT * queries)
      if (sql.trim().toUpperCase().startsWith('SELECT * FROM')) {
        try {
          const match = sql.match(/FROM\s+([\w"`.[\]]+)/i);
          if (match) {
            const tableRef = match[1];
            const countSql = connection.type === 'mongodb' 
              ? JSON.stringify({ action: 'count', collection: tableRef.replace(/['"`]/g, '') })
              : `SELECT COUNT(*) as total FROM ${tableRef}`;
            
            const countResult = await strategy.executeQuery(pool, countSql);
            if (countResult.rows && countResult.rows.length > 0) {
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
          category: 'query',
          connectionId, 
          database: database || connection.database, 
          sqlSnippet: sql.substring(0, 100) + (sql.length > 100 ? '...' : '') 
        }
      });

      return result;
    } catch (error) {
      // Re-throw ForbiddenException (confirmation required) as-is
      if (error instanceof ForbiddenException) throw error;

      console.error('Query Service Error:', error);
      throw new InternalServerErrorException(`Query execution failed: ${error.message}`);
    }
  }

  // ─── Row Mutations (DRY-refactored) ───

  async updateRow(updateRowDto: UpdateRowDto, userId: string) {
    const { connectionId, database, schema, table, pkColumn, pkValue, updates } = updateRowDto;
    const connection = await this.connectionsService.findOne(connectionId, userId);
    await this.assertWritePermission(connection, userId, 'update_row', 'allowQueryExecution', { table });

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
    await this.assertWritePermission(connection, userId, 'insert_row', 'allowQueryExecution', { table });

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
    await this.assertWritePermission(connection, userId, 'delete_rows', 'allowQueryExecution', { table, rowCount: pkValues.length });

    try {
      const pool = await this.connectionsService.getPool(connectionId, database || connection.database, userId);
      const strategy = this.strategyFactory.getStrategy(connection.type);
      return await strategy.deleteRows(pool, { schema, table, pkColumn, pkValues });
    } catch (error) {
      console.error('Delete Rows Error:', error);
      throw new InternalServerErrorException(`Delete failed: ${error.message}`);
    }
  }

  // ─── Schema Operations ───

  async updateSchema(updateSchemaDto: UpdateSchemaDto, userId: string) {
    const { connectionId, database, schema, table, operations } = updateSchemaDto;
    const connection = await this.connectionsService.findOne(connectionId, userId);
    if (!connection) throw new BadRequestException('Invalid connection ID');
    await this.assertWritePermission(connection, userId, 'update_schema', 'allowSchemaChanges', {
      table,
      operations: operations.map((op) => op.type),
    });

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
        results.push(await this.executeQuery({ connectionId, sql, database, confirmed: true }, userId));
      }
      await this.auditService.log({
        action: AuditAction.DB_SCHEMA_CHANGE,
        userId,
        details: { 
          category: 'schema',
          connectionId, 
          database, 
          schema, 
          table, 
          operations: operations.map(op => op.type) 
        }
      });

      return { success: true, results };
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      console.error('Update Schema Error:', error);
      throw new InternalServerErrorException(`Schema update failed: ${error.message}`);
    }
  }

  // ─── Seed & Database Management ───

  async seedData(connectionId: string, userId: string) {
    const connection = await this.connectionsService.findOne(connectionId, userId);
    await this.assertWritePermission(connection, userId, 'seed_data', 'allowQueryExecution');

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
    await this.assertWritePermission(connection, userId, 'create_database', 'allowSchemaChanges', { databaseName });

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
    await this.assertWritePermission(connection, userId, 'drop_database', 'allowSchemaChanges', { databaseName });

    if (!/^[a-zA-Z0-9_-]+$/.test(databaseName)) {
      throw new BadRequestException('Invalid database name.');
    }

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

      const droppedPoolKey = `${connectionId}:${databaseName}`;
      await this.connectionsService.removePool(droppedPoolKey, userId);

      return { success: true, message: `Database ${databaseName} dropped successfully.` };
    } catch (error) {
      console.error('Drop Database Error:', error);
      throw new InternalServerErrorException(`Failed to drop database: ${error.message}`);
    }
  }

  // ─── Data Import ───

  async importData(body: { connectionId: string; schema: string; table: string; data: any[] }, userId: string) {
    const { connectionId, schema, table, data } = body;
    const connection = await this.connectionsService.findOne(connectionId, userId);
    if (!connection) throw new BadRequestException('Invalid connection ID');
    await this.assertWritePermission(connection, userId, 'import_data', 'allowImportExport', { table });

    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new BadRequestException('No data provided for import.');
    }

    try {
      const pool = await this.connectionsService.getPool(connectionId, undefined, userId);
      const strategy = this.strategyFactory.getStrategy(connection.type);
      const result = await strategy.importData(pool, { schema, table, data });

      await this.auditService.log({
        action: AuditAction.DB_IMPORT,
        userId,
        details: { 
          category: 'import',
          connectionId, 
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
