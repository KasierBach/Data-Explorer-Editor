import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
  Inject,
  HttpException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
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
  isMongoPayloadAllowedOnReadOnly,
  isSqlAllowedOnReadOnly,
  splitSqlStatements,
  MAX_SQL_STATEMENTS,
} from './query-guard.util';
import { getErrorMessage } from '../common/utils/error.util';
import { SqlUtil } from '../utils/sql.util';
import type { QueryResult } from '../database-strategies';
import { PermissionsService } from '../permissions/services/permissions.service';
import { Permission } from '../permissions/enums/permission.enum';
import { ResourceType } from '../permissions/enums/resource-type.enum';
import {
  assertTeamConnectionAccess,
  parseRoleQueryModes,
} from '../permissions/utils/team-connection-access.util';
import { REDIS_READ_COMMANDS } from '../database-strategies/redis.strategy';
import {
  assertPrimaryKeyIdentities,
  validateRowIdentities,
} from '../database-strategies/row-identity.util';
import type { RowIdentity } from '../database-strategies/database-strategy.interface';
import type { QueryExecutionHandle } from '../database-strategies/database-strategy.interface';
import { queryDatabaseException } from './query-error.util';

interface ActiveQueryEntry {
  queryId: string;
  userId: string;
  connectionId: string;
  sql: string;
  startedAt: number;
  cancel: () => Promise<boolean>;
}

@Injectable()
export class QueryService {
  private readonly logger = new Logger(QueryService.name);
  private readonly QUERY_CACHE_TTL_MS = 60_000;
  /** In-flight queries per user, keyed by queryId, for cancellation. */
  private readonly activeQueries = new Map<string, ActiveQueryEntry>();
  private readonly MAX_ACTIVE_PER_USER = 5;
  private readonly DEFAULT_QUERY_LIMIT = 50_000;
  private readonly DEFAULT_TABLE_WINDOW_LIMIT = 100;
  private readonly MAX_TABLE_WINDOW_LIMIT = 1_000;

  constructor(
    private readonly connectionsService: ConnectionsService,
    private readonly strategyFactory: DatabaseStrategyFactory,
    private readonly auditService: AuditService,
    private readonly freshnessService: FreshnessService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly permissionsService: PermissionsService,
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
      [connectionId, database ?? null],
      [sql, ...optionParts],
    );
  }

  private async invalidateQueryCache(
    connectionId: string,
    database?: string,
  ): Promise<void> {
    await this.freshnessService.invalidateConnection(connectionId, database);
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

  private hasExplicitSqlLimit(sql: string, type: Connection['type']): boolean {
    if (!this.isSqlBrowseCapableConnection(type)) return false;
    const dialect = type === 'mariadb' ? 'mysql' : type;
    if (
      !['postgres', 'cockroach', 'mysql', 'mssql', 'sqlite', 'clickhouse'].includes(
        dialect,
      )
    ) {
      return false;
    }
    return Boolean(
      SqlUtil.analyzeOuterLimit(
        sql,
        (dialect === 'cockroach' ? 'postgres' : dialect) as
          | 'postgres'
          | 'mysql'
          | 'mssql'
          | 'sqlite'
          | 'clickhouse',
      )?.valid,
    );
  }

  private assertRawQueryLimit(
    sql: string,
    type: Connection['type'],
  ): void {
    if (!this.isSelectLikeQuery(sql) || !this.isSqlBrowseCapableConnection(type))
      return;

    const dialect =
      type === 'cockroach'
        ? 'postgres'
        : type === 'mariadb'
          ? 'mysql'
          : type;
    const outer = SqlUtil.analyzeOuterLimit(
      sql,
      dialect as 'postgres' | 'mysql' | 'mssql' | 'sqlite' | 'clickhouse',
    );
    if (!outer) return;

    if (!outer.valid || !outer.value || outer.value > this.DEFAULT_QUERY_LIMIT) {
      throw new BadRequestException(
        `Raw query results are capped at ${this.DEFAULT_QUERY_LIMIT.toLocaleString()} rows. Use result pagination or export for larger datasets.`,
      );
    }
  }

  private buildQueryCountSql(sql: string): string | undefined {
    if (!this.isSelectLikeQuery(sql)) return undefined;
    const normalized = sql.trim().replace(/;$/, '');
    return `SELECT COUNT(*) AS total FROM (${normalized}) AS _query_count`;
  }

  private async resolveQueryCount(
    strategy: {
      executeQuery: (
        pool: unknown,
        sql: string,
        options?: { readOnly?: boolean },
      ) => Promise<QueryResult>;
    },
    pool: unknown,
    countSql: string,
    cacheKey: string,
    readOnly = false,
    onExecution?: (execution: QueryExecutionHandle) => void,
  ): Promise<number | undefined> {
    const cachedCount = await this.cacheManager.get<number>(cacheKey);
    if (typeof cachedCount === 'number') return cachedCount;

    const options = {
      ...(readOnly ? { readOnly: true } : {}),
      ...(onExecution ? { onExecution } : {}),
    };
    const countResult =
      readOnly || onExecution
        ? await strategy.executeQuery(pool, countSql, options)
        : await strategy.executeQuery(pool, countSql);
    const count = this.extractCountValue(countResult);
    if (count !== undefined) {
      await this.cacheManager.set(cacheKey, count, this.QUERY_CACHE_TTL_MS);
    }
    return count;
  }
  private applyRawQueryMetadata(
    result: QueryResult,
    sql: string,
    options: { limit?: number; offset?: number },
    type: Connection['type'],
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

    if (!this.hasExplicitSqlLimit(sql, type)) {
      nextResult.appliedLimit = this.DEFAULT_QUERY_LIMIT;
      nextResult.limitSource = 'protective_default';
    }

    return nextResult;
  }

  private async resolveTableCount(
    strategy: {
      executeQuery: (
        pool: unknown,
        sql: string,
        options: { readOnly: boolean },
      ) => Promise<QueryResult>;
    },
    pool: unknown,
    quotedTable: string,
    cacheKey: string,
  ): Promise<number | undefined> {
    const cachedCount = await this.cacheManager.get<number>(cacheKey);
    if (typeof cachedCount === 'number') return cachedCount;

    const countResult = await strategy.executeQuery(
      pool,
      `SELECT COUNT(*) AS total FROM ${quotedTable}`,
      { readOnly: true },
    );

    const count = this.extractCountValue(countResult);
    if (count !== undefined) {
      await this.cacheManager.set(cacheKey, count, this.QUERY_CACHE_TTL_MS);
    }
    return count;
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
    await this.permissionsService.ensurePermission(
      userId,
      ResourceType.CONNECTION,
      connection.id,
      Permission.WRITE,
    );

    if (connection.organizationId) {
      const role = await this.permissionsService.getMemberRole(
        userId,
        connection.organizationId,
      );
      assertTeamConnectionAccess(
        connection,
        { userId, role },
        {
          database:
            typeof extra?.database === 'string'
              ? extra.database
              : typeof extra?.databaseName === 'string'
                ? extra.databaseName
                : connection.database,
          isReadOnlySql: false,
        },
      );
    }

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

  // ─────────────────────────────────────────────
  // Query Execution
  // ─────────────────────────────────────────────

  private async assertQueryAllowed(
    connection: any,
    sql: string,
    userId: string,
    database?: string,
    confirmed?: boolean,
  ) {
    const isMongo =
      connection.type === 'mongodb' || connection.type === 'mongodb+srv';
    const isRedis = connection.type === 'redis';
    if (!isMongo && !isRedis) {
      try {
        splitSqlStatements(sql, connection.type);
      } catch (error) {
        if (error instanceof RangeError)
          throw new BadRequestException(error.message);
        throw error;
      }
    }
    const isReadOnlyQuery = isMongo
      ? isMongoPayloadAllowedOnReadOnly(sql)
      : isRedis
        ? REDIS_READ_COMMANDS.has(sql.trim().split(/\s+/, 1)[0].toUpperCase())
        : isSqlAllowedOnReadOnly(sql, connection.type);
    // A read-classified SELECT can still invoke a mutating stored function.
    let readOnly =
      Boolean(connection.readOnly) || (!isMongo && !isRedis && isReadOnlyQuery);
    // 0. Team restrictions: database whitelist + per-role query modes.
    if (connection.organizationId) {
      const role = await this.permissionsService.getMemberRole(
        userId,
        connection.organizationId,
      );
      assertTeamConnectionAccess(
        connection,
        { userId, role },
        { database, sql, isReadOnlySql: isReadOnlyQuery },
      );
      if (connection.userId !== userId && role) {
        readOnly ||=
          parseRoleQueryModes(connection.roleQueryModes)?.[role] === 'readonly';
      }
    }

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
    if (isMongo || isRedis) {
      const action = isMongo
        ? getMongoActionFromPayload(sql)
        : sql.trim().split(/\s+/, 1)[0];
      if (!isReadOnlyQuery) {
        await this.permissionsService.ensurePermission(
          userId,
          ResourceType.CONNECTION,
          connection.id,
          Permission.WRITE,
        );
      }
      if (connection.readOnly && !isReadOnlyQuery) {
        await this.blockOperation(userId, {
          connectionId: connection.id,
          database,
          action: 'execute_query',
          reason: 'READ_ONLY_CONNECTION',
          message:
            'This connection is read-only. Only read operations are allowed.',
          extra: { databaseAction: action },
        });
      }
      if (
        (isMongo && action === 'aggregate' && !isReadOnlyQuery) ||
        (isRedis && !isReadOnlyQuery)
      ) {
        throw new BadRequestException(
          'Unsupported or unsafe query for this database command endpoint.',
        );
      }
      return readOnly;
    }

    // 3. Read-only connection: block all non-read queries
    if (!isReadOnlyQuery) {
      await this.permissionsService.ensurePermission(
        userId,
        ResourceType.CONNECTION,
        connection.id,
        Permission.WRITE,
      );
    }
    if (connection.readOnly && !isReadOnlyQuery) {
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
      let analysis;
      try {
        analysis = analyzeSqlConfirmation(sql, connection.type);
      } catch (error) {
        if (error instanceof RangeError) {
          throw new BadRequestException(error.message);
        }
        throw error;
      }
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
    return readOnly;
  }

  async executeQuery(
    createQueryDto: CreateQueryDto,
    userId: string,
    signal?: AbortSignal,
  ) {
    if (signal?.aborted)
      throw new BadRequestException('Query request was aborted.');
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
    const readOnly = await this.assertQueryAllowed(
      connection,
      sql,
      userId,
      database || connection.database,
      confirmed,
    );

    const startedAt = Date.now();
    try {
      const pool = await this.connectionsService.getPool(
        connectionId,
        database || connection.database,
        userId,
      );
      const strategy = this.strategyFactory.getStrategy(connection.type);

      const statements =
        connection.type === 'mongodb' ||
        connection.type === 'mongodb+srv' ||
        connection.type === 'redis'
          ? [sql]
          : splitSqlStatements(sql, connection.type);
      const executableStatements = statements.length > 0 ? statements : [sql];
      if (executableStatements.length > MAX_SQL_STATEMENTS) {
        throw new BadRequestException(
          `SQL query exceeds the maximum of ${MAX_SQL_STATEMENTS} statements.`,
        );
      }
      const statementCount = executableStatements.length;
      const finalSql = executableStatements[statementCount - 1];
      const isMultiStatement = executableStatements.length > 1;
      for (const statement of executableStatements) {
        this.assertRawQueryLimit(statement, connection.type);
      }

      // Register the in-flight query so the user can cancel it.
      const queryId = randomUUID();
      let execution: QueryExecutionHandle | undefined;
      let cancelRequested = false;
      const cancel = async () => {
        cancelRequested = true;
        return execution ? strategy.cancelActiveQuery(execution) : false;
      };
      this.registerActiveQuery(queryId, userId, connectionId, sql, cancel);

      let result: QueryResult;
      const onExecution = (handle: QueryExecutionHandle) => {
        execution = handle;
        if (cancelRequested) {
          void cancel().catch((error) =>
            this.logger.warn(getErrorMessage(error)),
          );
        }
      };
      const timeoutMs = this.getQueryTimeoutMs();
      const disconnected = () => {
        void cancel().catch((error) =>
          this.logger.warn(getErrorMessage(error)),
        );
      };
      signal?.addEventListener('abort', disconnected, { once: true });
      if (signal?.aborted) disconnected();
      try {
        const runQuery = async (): Promise<QueryResult> => {
          if (isMultiStatement) {
            // The strategy reports partial commits on engines with non-atomic DDL/batches.
            const multi = await strategy.runStatementsInTransaction(
              pool,
              executableStatements,
              {
                limit,
                offset,
                ...(readOnly ? { readOnly: true } : {}),
                onExecution,
                ...(!readOnly
                  ? {
                      onMutation: () =>
                        this.invalidateQueryCache(
                          connectionId,
                          database || connection.database,
                        ),
                    }
                  : {}),
              },
            );
            multi.countStatus ??= 'skipped';
            return multi;
          }
          return strategy.executeQuery(pool, finalSql, {
            limit,
            offset,
            ...(readOnly ? { readOnly: true } : {}),
            onExecution,
          });
        };

        const completeQuery = async () => {
          const nativeResult = await runQuery();
          let isReadQuery = readOnly;
          if (
            connection.type === 'mongodb' ||
            connection.type === 'mongodb+srv'
          ) {
            isReadQuery = isMongoPayloadAllowedOnReadOnly(sql);
          }
          if (connection.type === 'redis') {
            isReadQuery = REDIS_READ_COMMANDS.has(
              sql.trim().split(/\s+/, 1)[0].toUpperCase(),
            );
          }
          if (!isReadQuery)
            await this.invalidateQueryCache(
              connectionId,
              database || connection.database,
            );
          const queryResult = this.applyRawQueryMetadata(
            nativeResult,
            finalSql,
            { limit, offset },
            connection.type,
          );
          if (!isMultiStatement && includeTotalCount === true) {
            const countSql = this.buildQueryCountSql(finalSql);
            if (countSql) {
              try {
                const countCacheKey = await this.getQueryCacheKey(
                  connectionId,
                  `result-count:${countSql}`,
                  database || connection.database,
                );
                const totalCount = await this.resolveQueryCount(
                  strategy,
                  pool,
                  countSql,
                  countCacheKey,
                  readOnly,
                  onExecution,
                );
                if (totalCount !== undefined) {
                  queryResult.totalCount = totalCount;
                  queryResult.countStatus = 'available';
                } else {
                  queryResult.countStatus = 'unavailable';
                }
              } catch (countError) {
                queryResult.countStatus = 'unavailable';
                this.logger.warn(
                  'Failed to fetch query result count:',
                  getErrorMessage(countError),
                );
              }
            } else {
              queryResult.countStatus = 'skipped';
            }
          } else {
            queryResult.countStatus = 'skipped';
          }
          return queryResult;
        };
        result = await this.withQueryTimeout(
          completeQuery(),
          queryId,
          timeoutMs,
        );
      } finally {
        signal?.removeEventListener('abort', disconnected);
        this.activeQueries.delete(queryId);
      }
      // Expose the wall-clock execution time to the client so the results
      // panel and query history can display it.
      result.durationMs = Date.now() - startedAt;
      await this.auditService.log({
        action: AuditAction.DB_QUERY_EXECUTE,
        userId,
        details: {
          category: 'query',
          connectionId,
          database: database || connection.database,
          connectionName: connection.name,
          durationMs: Date.now() - startedAt,
          rowCount: result.rowCount ?? result.rows?.length,
          sql,
          sqlSnippet: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
        },
      });

      return result;
    } catch (error) {
      await this.freshnessService.invalidatePartialWrite(
        error,
        connectionId,
        database || connection.database,
      );
      if (error instanceof HttpException) throw error;

      const code =
        error && typeof error === 'object' && 'code' in error
          ? String(error.code)
          : '';
      if (
        readOnly &&
        (code === '25006' ||
          code === 'ER_CANT_EXECUTE_IN_READ_ONLY_TRANSACTION' ||
          code.startsWith('SQLITE_READONLY'))
      ) {
        await this.blockOperation(userId, {
          connectionId,
          database: database || connection.database,
          action: 'execute_query',
          reason: 'READ_ONLY_CONNECTION',
          message:
            'This connection is read-only. The database rejected a write operation.',
        });
      }

      const resolvedDatabase = database || connection.database || null;
      const rootCause = getErrorMessage(error);

      this.logger.error('Query Service Error Details:', rootCause);
      throw queryDatabaseException(error, connection.type, {
        message: resolvedDatabase
          ? `Query execution failed on database "${resolvedDatabase}": ${rootCause}`
          : `Query execution failed: ${rootCause}`,
        details: {
          connectionId,
          connectionType: connection.type,
          database: resolvedDatabase,
          rootCause,
        },
      });
    }
  }

  /** Query execution deadline (QUERY_TIMEOUT_MS, 60s default, 10min max). */
  private getQueryTimeoutMs(): number {
    const raw = Number(process.env.QUERY_TIMEOUT_MS || 60_000);
    if (!Number.isFinite(raw) || raw <= 0) return 60_000;
    return Math.min(raw, 600_000);
  }

  /** Cancels the query via its registered handle when the deadline hits. */
  private async withQueryTimeout<T>(
    promise: Promise<T>,
    queryId: string,
    timeoutMs: number,
  ): Promise<T> {
    let timedOut = false;
    const timeoutError = () =>
      new BadRequestException(
        `Query exceeded the maximum execution time of ${Math.round(timeoutMs / 1000)}s. Cancellation was requested; inspect the database and any writes before retrying.`,
      );
    const timer = setTimeout(() => {
      timedOut = true;
      const entry = this.activeQueries.get(queryId);
      if (entry)
        void entry
          .cancel()
          .catch((error) => this.logger.warn(getErrorMessage(error)));
    }, timeoutMs);
    try {
      const result = await promise;
      if (timedOut) throw timeoutError();
      return result;
    } catch (error) {
      if (timedOut) throw timeoutError();
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Registers an in-flight query with a cancellation handle. */
  private registerActiveQuery(
    queryId: string,
    userId: string,
    connectionId: string,
    sql: string,
    cancel: () => Promise<boolean>,
  ): void {
    // Enforce a per-user cap on concurrent queries.
    const userActive = [...this.activeQueries.values()].filter(
      (entry) => entry.userId === userId,
    );
    if (userActive.length >= this.MAX_ACTIVE_PER_USER) {
      throw new BadRequestException(
        `You already have ${this.MAX_ACTIVE_PER_USER} queries running. Wait for them to finish or cancel them.`,
      );
    }
    this.activeQueries.set(queryId, {
      queryId,
      userId,
      connectionId,
      sql: sql.length > 200 ? `${sql.slice(0, 200)}...` : sql,
      startedAt: Date.now(),
      cancel,
    });
  }

  /** Cancels a running query owned by the given user. */
  async cancelQuery(queryId: string, userId: string): Promise<boolean> {
    const entry = this.activeQueries.get(queryId);
    if (!entry) return false;
    if (entry.userId !== userId) {
      throw new ForbiddenException('You can only cancel your own queries.');
    }
    try {
      return await entry.cancel();
    } catch (error) {
      this.logger.warn(
        `Query cancellation failed for ${queryId}: ${getErrorMessage(error)}`,
      );
      return false;
    }
  }

  /** Lists the user's in-flight queries (for an active-queries panel). */
  getActiveQueries(userId: string) {
    return [...this.activeQueries.values()]
      .filter((entry) => entry.userId === userId)
      .map(({ queryId, connectionId, sql, startedAt }) => ({
        queryId,
        connectionId,
        sql,
        startedAt,
        elapsedMs: Date.now() - startedAt,
      }));
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
      sortBy,
      sortOrder,
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

      // Deterministic ordering: use explicit sortBy, or auto-detect PK, or fall back to first column
      let orderClause = '';
      if (sortBy) {
        const direction = sortOrder?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
        const quotedSort =
          typeof strategy.quoteIdentifier === 'function'
            ? strategy.quoteIdentifier(sortBy)
            : `"${sortBy}"`;
        orderClause = ` ORDER BY ${quotedSort} ${direction}`;
      } else {
        try {
          const columns =
            typeof strategy.getColumns === 'function'
              ? await strategy.getColumns(
                  pool,
                  schema ?? '',
                  table,
                  database || connection.database,
                )
              : [];
          const pkCol = columns?.find((c) => c.isPrimaryKey);
          if (pkCol) {
            const quotedPk =
              typeof strategy.quoteIdentifier === 'function'
                ? strategy.quoteIdentifier(pkCol.name)
                : `"${pkCol.name}"`;
            orderClause = ` ORDER BY ${quotedPk} ASC`;
          } else if (columns && columns.length > 0) {
            const quotedFirst =
              typeof strategy.quoteIdentifier === 'function'
                ? strategy.quoteIdentifier(columns[0].name)
                : `"${columns[0].name}"`;
            orderClause = ` ORDER BY ${quotedFirst} ASC`;
          }
        } catch {
          orderClause = '';
        }
      }

      const baseSql = `SELECT * FROM ${quotedTable}${orderClause}`;
      const result = await strategy.executeQuery(pool, baseSql, {
        limit: normalizedLimit,
        offset: normalizedOffset,
        readOnly: true,
      });

      const response: QueryResult = {
        ...result,
        appliedLimit: normalizedLimit,
        appliedOffset: normalizedOffset,
        limitSource: 'table_window',
      };

      if (includeTotalCount !== false) {
        try {
          const countCacheKey = await this.getQueryCacheKey(
            connectionId,
            `table-count:${quotedTable}`,
            database || connection.database,
          );
          const totalCount = await this.resolveTableCount(
            strategy,
            pool,
            quotedTable,
            countCacheKey,
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
      this.logger.error('Table Window Error Details:', getErrorMessage(error));
      throw queryDatabaseException(
        error,
        connection.type,
        'Table browsing failed. Please verify the selected table and connection permissions.',
      );
    }
  }

  private async prepareRowMutation(
    connection: Connection,
    userId: string,
    target: {
      connectionId: string;
      database?: string;
      schema: string;
      table: string;
      pkColumn: string;
    },
    identities: RowIdentity[],
    legacyValues: unknown[],
  ) {
    if (
      ![
        'postgres',
        'cockroach',
        'mysql',
        'mariadb',
        'sqlite',
        'mssql',
      ].includes(connection.type)
    ) {
      throw new BadRequestException(
        'Row editing is unavailable for this database until a unique, typed row identity can be verified.',
      );
    }
    validateRowIdentities(identities);
    if (
      !Array.isArray(legacyValues) ||
      legacyValues.length !== identities.length ||
      identities.some(
        (identity, index) =>
          identity[0].column !== target.pkColumn ||
          identity[0].value !== legacyValues[index],
      )
    ) {
      throw new BadRequestException(
        'Legacy key fields must match the supplied row identities.',
      );
    }
    if (
      connection.type === 'sqlite' &&
      target.schema &&
      !['main', 'public'].includes(target.schema)
    ) {
      throw new BadRequestException(
        'Row editing supports only the main SQLite schema.',
      );
    }
    const schema =
      connection.type === 'sqlite'
        ? 'main'
        : target.schema ||
          (['mysql', 'mariadb'].includes(connection.type)
            ? target.database || connection.database || ''
            : connection.type === 'mssql'
              ? 'dbo'
              : 'public');
    const pool = await this.connectionsService.getPool(
      target.connectionId,
      target.database || connection.database,
      userId,
    );
    const strategy = this.strategyFactory.getStrategy(connection.type);
    const columns = await strategy.getColumns(
      pool,
      schema,
      target.table,
      target.database || connection.database,
    );
    assertPrimaryKeyIdentities(identities, columns);
    return { pool, strategy, schema, columns };
  }

  async updateRow(updateRowDto: UpdateRowDto, userId: string) {
    const { connectionId, database, table, pkColumn, pkValue, updates } =
      updateRowDto;
    const connection = await this.connectionsService.findOne(
      connectionId,
      userId,
    );
    await this.assertWritePermission(
      connection,
      userId,
      'update_row',
      'allowQueryExecution',
      { table, database: database || connection.database },
    );

    const updateCols = Object.keys(updates);
    if (updateCols.length === 0)
      return { success: true, message: 'No changes' };

    try {
      const identities = [
        updateRowDto.identity ?? [{ column: pkColumn, value: pkValue }],
      ];
      const {
        pool,
        strategy,
        schema: resolvedSchema,
        columns,
      } = await this.prepareRowMutation(
        connection,
        userId,
        updateRowDto,
        identities,
        [pkValue],
      );
      if (
        updateCols.some(
          (name) => !columns.some((column) => column.name === name),
        )
      ) {
        throw new BadRequestException(
          'Update columns must exactly match verified table metadata.',
        );
      }
      if (
        updateCols.some((name) =>
          columns.some((column) => column.isPrimaryKey && column.name === name),
        )
      ) {
        throw new BadRequestException(
          'Changing primary-key columns through row editing is not supported.',
        );
      }
      const result = await strategy.updateRow(pool, {
        schema: resolvedSchema,
        table,
        pkColumn,
        pkValue,
        updates,
        identity: identities[0],
      });
      await this.invalidateQueryCache(
        connectionId,
        database || connection.database,
      );
      return result;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Update Row Error:', getErrorMessage(error));
      throw queryDatabaseException(
        error,
        connection.type,
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
      { table, database: database || connection.database },
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
      if (error instanceof HttpException) throw error;
      this.logger.error('Insert Row Error:', getErrorMessage(error));
      throw queryDatabaseException(
        error,
        connection.type,
        `Insert failed: ${getErrorMessage(error)}`,
      );
    }
  }

  async deleteRows(deleteRowsDto: DeleteRowsDto, userId: string) {
    const { connectionId, database, table, pkColumn, pkValues } = deleteRowsDto;
    const connection = await this.connectionsService.findOne(
      connectionId,
      userId,
    );
    await this.assertWritePermission(
      connection,
      userId,
      'delete_rows',
      'allowQueryExecution',
      {
        table,
        rowCount: Array.isArray(pkValues) ? pkValues.length : 0,
        database: database || connection.database,
      },
    );

    try {
      if (!Array.isArray(pkValues))
        throw new BadRequestException('Select a valid set of row identities.');
      const identities =
        deleteRowsDto.identities ??
        pkValues.map((value) => [{ column: pkColumn, value }]);
      const {
        pool,
        strategy,
        schema: resolvedSchema,
      } = await this.prepareRowMutation(
        connection,
        userId,
        deleteRowsDto,
        identities,
        pkValues,
      );
      const result = await strategy.deleteRows(pool, {
        schema: resolvedSchema,
        table,
        pkColumn,
        pkValues,
        identities,
      });
      await this.invalidateQueryCache(
        connectionId,
        database || connection.database,
      );
      return result;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Delete Rows Error:', getErrorMessage(error));
      throw queryDatabaseException(
        error,
        connection.type,
        `Delete failed: ${getErrorMessage(error)}`,
      );
    }
  }

  // ─────────────────────────────────────────────
  // Schema Operations
  // ─────────────────────────────────────────────

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
        database: database || connection.database,
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
      if (error instanceof HttpException) throw error;
      this.logger.error('Update Schema Error:', getErrorMessage(error));
      throw queryDatabaseException(
        error,
        connection.type,
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
      const result = await strategy.seedData(pool, {
        onMutation: () =>
          this.invalidateQueryCache(
            connectionId,
            connection.database || undefined,
          ),
      });
      await this.invalidateQueryCache(
        connectionId,
        connection.database || undefined,
      );
      return result;
    } catch (error) {
      await this.freshnessService.invalidatePartialWrite(
        error,
        connectionId,
        connection.database,
      );
      this.logger.error('Seed Data Error:', getErrorMessage(error));
      throw queryDatabaseException(
        error,
        connection.type,
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
      throw queryDatabaseException(
        error,
        connection.type,
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
        : connection.type === 'postgres' || connection.type === 'cockroach'
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
      await this.invalidateQueryCache(connectionId, databaseName);

      const droppedPoolKey = `${connectionId}:${databaseName}`;
      await this.connectionsService.removePool(droppedPoolKey, userId);

      return {
        success: true,
        message: `Database ${databaseName} dropped successfully.`,
      };
    } catch (error) {
      this.logger.error('Drop Database Error:', getErrorMessage(error));
      throw queryDatabaseException(
        error,
        connection.type,
        `Failed to drop database: ${getErrorMessage(error)}`,
      );
    }
  }

  // ─────────────────────────────────────────────
  // Data Import
  // ─────────────────────────────────────────────

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
      await this.freshnessService.invalidatePartialWrite(
        error,
        connectionId,
        connection.database,
      );
      this.logger.error('Import Data Error:', getErrorMessage(error));
      throw queryDatabaseException(
        error,
        connection.type,
        `Import failed: ${getErrorMessage(error)}`,
      );
    }
  }
}
