import { Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { PostgresStrategy } from './postgres.strategy';
import type {
    ConnectionConfig,
    DatabaseMetrics,
} from './database-strategy.interface';

@Injectable()
export class CockroachDbStrategy extends PostgresStrategy {
    private readonly cockroachLogger = new Logger(CockroachDbStrategy.name);

    createPool(
        connectionConfig: ConnectionConfig,
        databaseOverride?: string,
    ): Pool {
        const resolvedConfig =
            connectionConfig.port == null || connectionConfig.port === 0
                ? { ...connectionConfig, port: COCKROACH_DEFAULT_PORT }
                : connectionConfig;
        return super.createPool(resolvedConfig, databaseOverride);
    }

    async getDatabaseMetrics(pool: Pool): Promise<DatabaseMetrics> {
        const tableCountSql = `
            SELECT count(*) as table_count
            FROM information_schema.tables
            WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
        `;
        const typesSql = `
            SELECT table_type as type, count(*) as count
            FROM information_schema.tables
            WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
            GROUP BY table_type
        `;

        const [tableCountRes, typesRes] = await Promise.all([
            pool.query(tableCountSql),
            pool.query(typesSql),
        ]);

        let sizeBytes = 0;
        let activeConnections = 0;
        let topTables: { name: string; sizeBytes: number }[] = [];
        try {
            const [sizesRes, sessionsRes] = await Promise.all([
                pool.query(
                    `SELECT coalesce(sum(size), 0) as size_bytes
                   FROM crdb_internal.tables
                   WHERE database_name = current_database()`,
                ),
                pool.query(`SELECT count(*) as count FROM crdb_internal.cluster_sessions`),
            ]);
            sizeBytes = parseInt(sizesRes.rows[0]?.size_bytes ?? '0', 10) || 0;
            activeConnections =
                parseInt(sessionsRes.rows[0]?.count ?? '0', 10) || 0;

            const topTablesRes = await pool.query(
                `SELECT name, size as size_bytes
                 FROM crdb_internal.tables
                 WHERE database_name = current_database() AND name IS NOT NULL
                 ORDER BY size DESC LIMIT 5`,
            );
            topTables = topTablesRes.rows.map(
                (r: { name: string; size_bytes: unknown }) => ({
                    name: r.name,
                    sizeBytes: parseInt(String(r.size_bytes ?? '0'), 10) || 0,
                }),
            );
        } catch (error) {
            this.cockroachLogger.warn(
                'CockroachDB crdb_internal metrics unavailable, returning partial metrics: ' +
                (error instanceof Error ? error.message : String(error)),
            );
        }

        return {
            tableCount: parseInt(tableCountRes.rows[0]?.table_count ?? '0', 10) || 0,
            sizeBytes,
            activeConnections,
            topTables,
            tableTypes: typesRes.rows.map((r: { type: string; count: string }) => ({
                type: r.type,
                count: parseInt(r.count, 10) || 0,
            })),
        };
    }
}

const COCKROACH_DEFAULT_PORT = 26257;
