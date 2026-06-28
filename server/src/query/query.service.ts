import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { CreateQueryDto } from './dto/create-query.dto';
import { FetchTableWindowDto } from './dto/fetch-table-window.dto';
import { UpdateRowDto } from './dto/update-row.dto';
import { InsertRowDto } from './dto/insert-row.dto';
import { DeleteRowsDto } from './dto/delete-rows.dto';
import { UpdateSchemaDto } from './dto/update-schema.dto';
import { ConnectionsService } from '../connections/connections.service';
import { DatabaseStrategyFactory } from '../database-strategies';
import { AuditService, AuditAction } from '../audit/audit.service';
import { Connection } from '../connections/entities/connection.entity';
import { FreshnessService } from '../common/freshness/freshness.service';
import {
  analyzeSqlConfirmation,
  getMongoActionFromPayload,
  isMongoActionAllowedOnReadOnly,
  isSqlAllowedOnReadOnly,
  splitSqlStatements,
} from './query-guard.util';
import {
  getErrorMessage,
  isForbiddenException,
} from '../common/utils/error.util';
import { SqlUtil } from '../utils/sql.util';
import type { QueryResult } from '../database-strategies';

@Injectable()
export class QueryService {
  private readonly logger = new Logger(QueryService.name);
  private readonly QUERY_CACHE_TTL_MS = 60_000;
  private readonly DEFAULT_QUERY_LIMIT = 50_000;
  private readonly DEFAULT_TABLE_WINDOW_LIMIT = 100;
  private readonly MAX_TABLE_WINDOW_LIMIT = 1_000;

  constructor(
    private readonly connectionsService: ConnectionsService,
    private readonly strategyFactory: DatabaseStrategyFactory,
    private readonly auditService: AuditService,
    private readonly freshnessService: FreshnessService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  private async getQueryCacheKey(
    connectionId: string,
    sql: string,
    database?: string,
    options?: { limit?: number; offset?: number; includeTotalCount?: boolean },
  ): Promise<string> {
    const optionParts = [
      options?.limit !== undefined ? `limit:${options.limit}` : null,
      options?.offset !== undefined ? `offset:${options.offset}` : null,
      options?.includeTotalCount === false ? 'total:0' : null,
    ].filter((part): part is string => Boolean(part));

    return this.freshnessService.buildKey(
      'query',
      [connectionId, database || 'default'],
      [sql.trim().toLowerCase(), ...optionParts],
    );
  }

  private isCacheableQuery(sql: string): boolean {
    const trimmed = sql.trim().toUpperCase();
    return (
      trimmed.startsWith('SELECT') &&
      !trimmed.includes('NOW()') &&
      !trimmed.includes('RAND()')
    );
  }

  private async invalidateQueryCache(
    connectionId: string,
    database?: string,
  ): Promise<void> {
    await this.freshnessService.bump('query', [
      connectionId,
      database || 'default',
    ]);
    await this.freshnessService.bump('metadata', [connectionId]);
    await this.freshnessService.bump('ai-schema', [
      connectionId,
      database || 'default',
    ]);
    this.logger.debug(`Freshness bumped for connection ${connectionId}`);
  }

  private extractCountValue(result: QueryResult): number | undefined {
    if (!result.rows?.length) return undefined;

    const firstRow = result.rows[0];
    const countVal =
      firstRow.total ??
      firstRow.TOTAL ??
      firstRow.count ??
      firstRow.COUNT ??
      firstRow[Object.keys(firstRow)[0]];
    const parsed = Number.parseInt(String(countVal), 10);

    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private isSqlBrowseCapableConnection(type: Connection['type']): boolean {
    return !['mongodb', 'mongodb+srv', 'mock'].includes(type);
  }

  private isSelectLikeQuery(sql: string): boolean {
    return /^\s*(SELECT|WITH)\b/i.test(sql.trim());
  }

  private hasExplicitSqlLimit(sql: string): boolean {
    return /\b(LIMIT|TOP|FETCH\s+NEXT)\b/i.test(sql);
  }

  private applyRawQueryMetadata(
    result: QueryResult,
    sql: string,
    options: { limit?: number; offset?: number },
  ): QueryResult {
    const nextResult: QueryResult = { ...result };

    if (options.offset !== undefined) {
      nextResult.appliedOffset = options.offset;
    }

    if (!this.isSelectLikeQuery(sql)) {
      nextResult.countStatus ??= 'skipped';
      return nextResult;
    }

    if (options.limit !== undefined) {
      nextResult.appliedLimit = options.limit;
      nextResult.limitSource = 'requested';
      return nextResult;
    }

    if (!this.hasExplicitSqlLimit(sql)) {
      nextResult.appliedLimit = this.DEFAULT_QUERY_LIMIT;
      nextResult.limitSource = 'protective_default';
    }

    return nextResult;
  }

  private async resolveTableCount(
    strategy: {
      executeQuery: (pool: unknown, sql: string) => Promise<QueryResult>;
    },
    pool: unknown,
    quotedTable: string,
  ): Promise<number | undefined> {
    const countResult = await strategy.executeQuery(
      pool,
      `SELECT COUNT(*) AS total FROM ${quotedTable}`,
    );

    return this.extractCountValue(countResult);
  }

  private async blockOperation(
    userId: string,
    details: {
      connectionId: string;
      database?: string;
      action: string;
      reason: string;
      message: string;
      sqlSnippet?: string;
      extra?: Record<string, unknown>;
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

  private async assertWritePermission(
    connection: Connection,
    userId: string,
    action: string,
    permissionFlag:
      | 'allowQueryExecution'
      | 'allowSchemaChanges'
      | 'allowImportExport',
    extra?: Record<string, unknown>,
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

  // â”€â”€â”€ Query Execution â”€â”€â”€

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

    // 2. MongoDB read-only check
    if (connection.type === 'mongodb' || connection.type === 'mongodb+srv') {
      const action = getMongoActionFromPayload(sql);
      if (connection.readOnly && !isMongoActionAllowedOnReadOnly(action)) {
        await this.blockOperation(userId, {
          connectionId: connection.id,
          database,
          action: 'execute_query',
          reason: 'READ_ONLY_CONNECTION',
          message:
            'This connection is read-only. Only read operations are allowed.',
          extra: { mongoAction: action },
        });
      }
      return;
    }

    // 3. Read-only connection: block all non-read queries
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

    // 4. Non-readOnly connection: confirm only truly high-impact SQL
    if (!connection.readOnly) {
      const analysis = analyzeSqlConfirmation(sql);
      const statementLabel =
        analysis.statementCount &&
        analysis.statementCount > 1 &&
        analysis.statementIndex
          ? `Statement ${analysis.statementIndex} of ${analysis.statementCount}`
          : 'Statement';
      const confirmationMessage =
        analysis.summary ||
        `This query contains destructive operations (${analysis.keywords.join(', ')}). Please confirm to proceed.`;

      if (analysis.requiresConfirmation && !confirmed) {
        await this.auditService.log({
          action: AuditAction.DB_QUERY_BLOCKED,
          userId,
          details: {
            connectionId: connection.id,
            database,
            action: 'execute_query',
            reason: 'DESTRUCTIVE_REQUIRES_CONFIRMATION',
            sqlSnippet: sql.slice(0, 200),
            flaggedStatementSnippet: analysis.statement?.slice(0, 200),
            severity: analysis.severity,
            keywords: analysis.keywords,
            affectedObject: analysis.affectedObject,
            objectType: analysis.objectType,
            impactScope: analysis.impactScope,
            summary: analysis.summary,
            destructiveReason: analysis.reason,
            statementIndex: analysis.statementIndex,
            statementCount: analysis.statementCount,
            flaggedStatements: analysis.flaggedStatements,
          },
        });

        throw new ForbiddenException({
          message:
            analysis.statementCount && analysis.statementCount > 1
              ? `${statementLabel} requires confirmation. ${confirmationMessage}`
              : confirmationMessage,
          reason: 'DESTRUCTIVE_REQUIRES_CONFIRMATION',
          action: 'execute_query',
          details: {
            requiresConfirmation: true,
            analysis,
          },
        });
      }

      if (analysis.requiresConfirmation && confirmed) {
        await this.auditService.log({
          action: AuditAction.DB_QUERY_DESTRUCTIVE_CONFIRMED,
          userId,
          details: {
            connectionId: connection.id,
            database,
            sqlSnippet: sql.slice(0, 200),
            flaggedStatementSnippet: analysis.statement?.slice(0, 200),
            severity: analysis.severity,
            keywords: analysis.keywords,
            affectedObject: analysis.affectedObject,
            objectType: analysis.objectType,
            impactScope: analysis.impactScope,
            summary: analysis.summary,
            destructiveReason: analysis.reason,
            statementIndex: analysis.statementIndex,
            statementCount: analysis.statementCount,
            flaggedStatements: analysis.flaggedStatements,
          },
        });
      }
    }
  }

  async executeQuery(createQueryDto: CreateQueryDto, userId: string) {
    const {
      connectionId,
      sql,
      database,
      limit,
      offset,
      confirmed,
      includeTotalCount,
    } = createQueryDto;
    const connection = await this.connectionsService.findOne(
      connectionId,
      userId,
    );
    await this.assertQueryAllowed(
      connection,
      sql,
      userId,
      database || connection.database,
      confirmed,
    );

    try {
      const pool = await this.connectionsService.getPool(
        connectionId,
        database || connection.database,
        userId,
      );
      const strategy = this.strategyFactory.getStrategy(connection.type);

      const statements =
        connection.type === 'mongodb' || connection.type === 'mongodb+srv'
          ? [sql]
          : splitSqlStatements(sql);
      const executableStatements = statements.length > 0 ? statements : [sql];
      const finalSql = executableStatements[executableStatements.length - 1];
      const isMultiStatement = executableStatements.length > 1;

      const isCacheable = !isMultiStatement && this.isCacheableQuery(finalSql);
      const cacheKey = isCacheable
        ? await this.getQueryCacheKey(
            connectionId,
            finalSql,
            database || connection.database,
            {
              limit,
              offset,
              includeTotalCount,
            },
          )
        : null;

      if (cacheKey) {
        const cachedResult = await this.cacheManager.get(cacheKey);
        if (cachedResult) {
          return { ...cachedResult, cached: true };
        }
      }

      let result: QueryResult;
      if (isMultiStatement) {
        result = { rows: [], columns: [], countStatus: 'skipped' };
        for (let index = 0; index < executableStatements.length; index++) {
          const statement = executableStatements[index];
          const isLastStatement = index === executableStatements.length - 1;
          result = await strategy.executeQuery(
            pool,
            statement,
            isLastStatement ? { limit, offset } : undefined,
          );
        }
        result.countStatus ??= 'skipped';
      } else {
        result = await strategy.executeQuery(pool, finalSql, { limit, offset });
      }
      result = this.applyRawQueryMetadata(result, finalSql, { limit, offset });

      // Attempt to get totalCount for table views (standard SELECT * queries)
      if (
        !isMultiStatement &&
        includeTotalCount !== false &&
        finalSql.trim().toUpperCase().startsWith('SELECT * FROM')
      ) {
        try {
          const match = finalSql.match(/FROM\s+([\w"`.[\]]+)/i);
          if (match) {
            const tableRef = match[1];
            const countSql =
              connection.type === 'mongodb'
                ? JSON.stringify({
                    action: 'count',
                    collection: tableRef.replace(/['"`]/g, ''),
                  })
                : `SELECT COUNT(*) as total FROM ${tableRef}`;

            const countResult = await strategy.executeQuery(pool, countSql);
            const totalCount = this.extractCountValue(countResult);

            if (totalCount !== undefined) {
              result.totalCount = totalCount;
              result.countStatus = 'available';
            } else {
              result.countStatus = 'unavailable';
            }
          }
        } catch (countError) {
          result.countStatus = 'unavailable';
          this.logger.warn(
            'Failed to fetch total row count:',
            countError instanceof Error
              ? countError.message
              : String(countError),
          );
        }
      } else if (includeTotalCount === false || isMultiStatement) {
        result.countStatus = 'skipped';
      }

      if (cacheKey && result.rows) {
        await this.cacheManager.set(cacheKey, result, this.QUERY_CACHE_TTL_MS);
      }

      await this.auditService.log({
        action: AuditAction.DB_QUERY_EXECUTE,
        userId,
        details: {
          category: 'query',
          connectionId,
          database: database || connection.database,
          sqlSnippet: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
        },
      });

      return result;
    } catch (error) {
      if (isForbiddenException(error)) throw error;

      this.logger.error('Query Service Error Details:', getErrorMessage(error));
      throw new InternalServerErrorException(
        'Query execution failed. Please check your syntax or connection permissions.',
      );
    }
  }

  async fetchTableWindow(
    fetchTableWindowDto: FetchTableWindowDto,
    userId: string,
  ) {
    const {
      connectionId,
      database,
      schema,
      table,
      includeTotalCount,
      limit,
      offset,
    } = fetchTableWindowDto;

    const connection = await this.connectionsService.findOne(
      connectionId,
      userId,
    );

    if (!connection.allowQueryExecution) {
      await this.blockOperation(userId, {
        connectionId: connection.id,
        database: database || connection.database,
        action: 'fetch_table_window',
        reason: 'QUERY_EXECUTION_DISABLED',
        message: 'Table browsing is disabled for this connection.',
        extra: { table },
      });
    }

    if (!this.isSqlBrowseCapableConnection(connection.type)) {
      throw new BadRequestException(
        `Table-window browsing is not supported for ${connection.type} connections.`,
      );
    }

    const normalizedLimit = SqlUtil.sanitizeLimit(
      limit ?? this.DEFAULT_TABLE_WINDOW_LIMIT,
      this.MAX_TABLE_WINDOW_LIMIT,
    );
    const normalizedOffset = Math.max(0, offset ?? 0);

    try {
      const pool = await this.connectionsService.getPool(
        connectionId,
        database || connection.database,
        userId,
      );
      const strategy = this.strategyFactory.getStrategy(connection.type);
      const quotedTable = strategy.quoteTable(schema, table);
      const baseSql = `SELECT * FROM ${quotedTable}`;
      const cacheKey = await this.getQueryCacheKey(
        connectionId,
        `table-window:${baseSql}`,
        database || connection.database,
        {
          limit: normalizedLimit,
          offset: normalizedOffset,
          includeTotalCount,
        },
      );

      const cachedResult = await this.cacheManager.get<QueryResult>(cacheKey);
      if (cachedResult) {
        return { ...cachedResult, cached: true };
      }

      const result = await strategy.executeQuery(pool, baseSql, {
        limit: normalizedLimit,
        offset: normalizedOffset,
      });

      const response: QueryResult = {
        ...result,
        appliedLimit: normalizedLimit,
        appliedOffset: normalizedOffset,
        limitSource: 'table_window',
      };

      if (includeTotalCount !== false) {
        try {
          const totalCount = await this.resolveTableCount(
            strategy,
            pool,
            quotedTable,
          );
          if (totalCount !== undefined) {
            response.totalCount = totalCount;
            response.countStatus = 'available';
          } else {
            response.countStatus = 'unavailable';
          }
        } catch (countError) {
          response.countStatus = 'unavailable';
          this.logger.warn(
            'Failed to fetch table-window row count:',
            countError instanceof Error
              ? countError.message
              : String(countError),
          );
        }
      } else {
        response.countStatus = 'skipped';
      }

      await this.cacheManager.set(cacheKey, response, this.QUERY_CACHE_TTL_MS);

      await this.auditService.log({
        action: AuditAction.DB_QUERY_EXECUTE,
        userId,
        details: {
          category: 'table_window',
          connectionId,
          database: database || connection.database,
          schema,
          table,
          limit: normalizedLimit,
          offset: normalizedOffset,
        },
      });

      return response;
    } catch (error) {
      if (isForbiddenException(error)) throw error;

      this.logger.error('Table Window Error Details:', getErrorMessage(error));
      throw new InternalServerErrorException(
        'Table browsing failed. Please verify the selected table and connection permissions.',
      );
    }
  }

  async updateRow(updateRowDto: UpdateRowDto, userId: string) {
    const {
      connectionId,
      database,
      schema,
      table,
      pkColumn,
      pkValue,
      updates,
    } = updateRowDto;
    const connection = await this.connectionsService.findOne(
      connectionId,
      userId,
    );
    await this.assertWritePermission(
      connection,
      userId,
      'update_row',
      'allowQueryExecution',
      { table },
    );

    const updateCols = Object.keys(updates);
    if (updateCols.length === 0)
      return { success: true, message: 'No changes' };

    try {
      const pool = await this.connectionsService.getPool(
        connectionId,
        database,
        userId,
      );
      const strategy = this.strategyFactory.getStrategy(connection.type);
      const result = await strategy.updateRow(pool, {
        schema,
        table,
        pkColumn,
        pkValue,
        updates,
      });
      await this.invalidateQueryCache(
        connectionId,
        database || connection.database,
      );
      return result;
    } catch (error) {
      this.logger.error('Update Row Error:', getErrorMessage(error));
      throw new InternalServerErrorException(
        `Update failed: ${getErrorMessage(error)}`,
      );
    }
  }

  async insertRow(insertRowDto: InsertRowDto, userId: string) {
    const { connectionId, database, schema, table, data } = insertRowDto;
    const connection = await this.connectionsService.findOne(
      connectionId,
      userId,
    );
    await this.assertWritePermission(
      connection,
      userId,
      'insert_row',
      'allowQueryExecution',
      { table },
    );

    try {
      const pool = await this.connectionsService.getPool(
        connectionId,
        database || connection.database,
        userId,
      );
      const strategy = this.strategyFactory.getStrategy(connection.type);
      const result = await strategy.insertRow(pool, { schema, table, data });
      await this.invalidateQueryCache(
        connectionId,
        database || connection.database,
      );
      return result;
    } catch (error) {
      this.logger.error('Insert Row Error:', getErrorMessage(error));
      throw new InternalServerErrorException(
        `Insert failed: ${getErrorMessage(error)}`,
      );
    }
  }

  async deleteRows(deleteRowsDto: DeleteRowsDto, userId: string) {
    const { connectionId, database, schema, table, pkColumn, pkValues } =
      deleteRowsDto;
    const connection = await this.connectionsService.findOne(
      connectionId,
      userId,
    );
    await this.assertWritePermission(
      connection,
      userId,
      'delete_rows',
      'allowQueryExecution',
      { table, rowCount: pkValues.length },
    );

    try {
      const pool = await this.connectionsService.getPool(
        connectionId,
        database || connection.database,
        userId,
      );
      const strategy = this.strategyFactory.getStrategy(connection.type);
      const result = await strategy.deleteRows(pool, {
        schema,
        table,
        pkColumn,
        pkValues,
      });
      await this.invalidateQueryCache(
        connectionId,
        database || connection.database,
      );
      return result;
    } catch (error) {
      this.logger.error('Delete Rows Error:', getErrorMessage(error));
      throw new InternalServerErrorException(
        `Delete failed: ${getErrorMessage(error)}`,
      );
    }
  }

  // â”€â”€â”€ Schema Operations â”€â”€â”€

  async updateSchema(updateSchemaDto: UpdateSchemaDto, userId: string) {
    const { connectionId, database, schema, table, operations } =
      updateSchemaDto;
    const connection = await this.connectionsService.findOne(
      connectionId,
      userId,
    );
    if (!connection) throw new BadRequestException('Invalid connection ID');
    await this.assertWritePermission(
      connection,
      userId,
      'update_schema',
      'allowSchemaChanges',
      {
        table,
        operations: operations.map((op) => op.type),
      },
    );

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
        results.push(
          await this.executeQuery(
            { connectionId, sql, database, confirmed: true },
            userId,
          ),
        );
      }
      await this.invalidateQueryCache(
        connectionId,
        database || connection.database,
      );
      await this.auditService.log({
        action: AuditAction.DB_SCHEMA_CHANGE,
        userId,
        details: {
          category: 'schema',
          connectionId,
          database,
          schema,
          table,
          operations: operations.map((op) => op.type),
        },
      });

      return { success: true, results };
    } catch (error) {
      if (isForbiddenException(error)) throw error;
      this.logger.error('Update Schema Error:', getErrorMessage(error));
      throw new InternalServerErrorException(
        `Schema update failed: ${getErrorMessage(error)}`,
      );
    }
  }

  async seedData(connectionId: string, userId: string) {
    const connection = await this.connectionsService.findOne(
      connectionId,
      userId,
    );
    await this.assertWritePermission(
      connection,
      userId,
      'seed_data',
      'allowQueryExecution',
    );

    try {
      const pool = await this.connectionsService.getPool(
        connectionId,
        undefined,
        userId,
      );
      const strategy = this.strategyFactory.getStrategy(connection.type);
      const result = await strategy.seedData(pool);
      await this.invalidateQueryCache(
        connectionId,
        connection.database || undefined,
      );
      return result;
    } catch (error) {
      this.logger.error('Seed Data Error:', getErrorMessage(error));
      throw new InternalServerErrorException(
        `Seed data failed: ${getErrorMessage(error)}`,
      );
    }
  }

  async createDatabase(
    connectionId: string,
    databaseName: string,
    userId: string,
  ) {
    const connection = await this.connectionsService.findOne(
      connectionId,
      userId,
    );
    if (!connection) throw new BadRequestException('Invalid connection ID');
    await this.assertWritePermission(
      connection,
      userId,
      'create_database',
      'allowSchemaChanges',
      { databaseName },
    );

    if (!/^[a-zA-Z0-9_-]+$/.test(databaseName)) {
      throw new BadRequestException(
        'Invalid database name. Only alphanumeric characters, underscores, and hyphens are allowed.',
      );
    }

    try {
      const pool = await this.connectionsService.getPool(
        connectionId,
        undefined,
        userId,
      );
      const strategy = this.strategyFactory.getStrategy(connection.type);
      await strategy.createDatabase(pool, databaseName);
      await this.invalidateQueryCache(connectionId, databaseName);
      return {
        success: true,
        message: `Database ${databaseName} created successfully.`,
      };
    } catch (error) {
      this.logger.error('Create Database Error:', getErrorMessage(error));
      throw new InternalServerErrorException(
        `Failed to create database: ${getErrorMessage(error)}`,
      );
    }
  }

  async dropDatabase(
    connectionId: string,
    databaseName: string,
    userId: string,
  ) {
    const connection = await this.connectionsService.findOne(
      connectionId,
      userId,
    );
    if (!connection) throw new BadRequestException('Invalid connection ID');
    await this.assertWritePermission(
      connection,
      userId,
      'drop_database',
      'allowSchemaChanges',
      { databaseName },
    );

    if (!/^[a-zA-Z0-9_-]+$/.test(databaseName)) {
      throw new BadRequestException('Invalid database name.');
    }

    const adminDb =
      connection.database && connection.database !== databaseName
        ? connection.database
        : connection.type === 'postgres'
          ? 'postgres'
          : connection.database;

    if (adminDb === databaseName) {
      throw new BadRequestException(
        'Cannot drop the default connection database. Connect to a different database first.',
      );
    }

    try {
      const pool = await this.connectionsService.getPool(
        connectionId,
        adminDb,
        userId,
      );
      const strategy = this.strategyFactory.getStrategy(connection.type);
      await strategy.dropDatabase(pool, databaseName);

      const droppedPoolKey = `${connectionId}:${databaseName}`;
      await this.connectionsService.removePool(droppedPoolKey, userId);
      await this.invalidateQueryCache(connectionId, databaseName);

      return {
        success: true,
        message: `Database ${databaseName} dropped successfully.`,
      };
    } catch (error) {
      this.logger.error('Drop Database Error:', getErrorMessage(error));
      throw new InternalServerErrorException(
        `Failed to drop database: ${getErrorMessage(error)}`,
      );
    }
  }

  // â”€â”€â”€ Data Import â”€â”€â”€

  async importData(
    body: { connectionId: string; schema: string; table: string; data: any[] },
    userId: string,
  ) {
    const { connectionId, schema, table, data } = body;
    const connection = await this.connectionsService.findOne(
      connectionId,
      userId,
    );
    if (!connection) throw new BadRequestException('Invalid connection ID');
    await this.assertWritePermission(
      connection,
      userId,
      'import_data',
      'allowImportExport',
      { table },
    );

    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new BadRequestException('No data provided for import.');
    }

    try {
      const pool = await this.connectionsService.getPool(
        connectionId,
        undefined,
        userId,
      );
      const strategy = this.strategyFactory.getStrategy(connection.type);
      const result = await strategy.importData(pool, { schema, table, data });
      await this.invalidateQueryCache(
        connectionId,
        connection.database || undefined,
      );

      await this.auditService.log({
        action: AuditAction.DB_IMPORT,
        userId,
        details: {
          category: 'import',
          connectionId,
          table: `${schema ? schema + '.' : ''}${table}`,
          rowCount: result.rowCount,
        },
      });

      return result;
    } catch (error) {
      this.logger.error('Import Data Error:', getErrorMessage(error));
      throw new InternalServerErrorException(
        `Import failed: ${getErrorMessage(error)}`,
      );
    }
  }
}
