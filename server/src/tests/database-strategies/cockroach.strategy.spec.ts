import { CockroachDbStrategy } from '../../database-strategies/cockroach.strategy';
import { Pool } from 'pg';

jest.mock('pg', () => {
    return {
        Pool: jest.fn().mockImplementation(() => ({
            connect: jest.fn(),
            query: jest.fn(),
            end: jest.fn(),
            on: jest.fn(),
        })),
    };
});

describe('CockroachDbStrategy', () => {
    let strategy: CockroachDbStrategy;
    let mockPool: any;

    beforeEach(() => {
        strategy = new CockroachDbStrategy();
        mockPool = new Pool();
        (Pool as unknown as jest.Mock).mockClear();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createPool', () => {
        it('defaults the port to 26257 when the API does not send one', () => {
            strategy.createPool({
                host: 'localhost',
                username: 'root',
                password: 'password',
                database: 'defaultdb',
            });

            expect(Pool).toHaveBeenCalledWith(
                expect.objectContaining({
                    host: 'localhost',
                    port: 26257,
                }),
            );
        });

        it('keeps an explicitly provided port', () => {
            strategy.createPool({
                host: 'localhost',
                port: 26260,
                username: 'root',
                password: 'password',
                database: 'defaultdb',
            });

            expect(Pool).toHaveBeenCalledWith(
                expect.objectContaining({
                    port: 26260,
                }),
            );
        });

        it('treats port 0 as missing and falls back to 26257', () => {
            strategy.createPool({
                host: 'localhost',
                port: 0,
                username: 'root',
                password: 'password',
                database: 'defaultdb',
            });

            expect(Pool).toHaveBeenCalledWith(
                expect.objectContaining({
                    port: 26257,
                }),
            );
        });
    });

    describe('getDatabaseMetrics', () => {
        it('uses CockroachDB crdb_internal tables instead of PostgreSQL-specific SQL', async () => {
            mockPool.query.mockImplementation((sql: string) => {
                if (sql.includes('count(*) as table_count')) {
                    return Promise.resolve({ rows: [{ table_count: '12' }] });
                }
                if (sql.includes('GROUP BY table_type')) {
                    return Promise.resolve({
                        rows: [{ type: 'BASE TABLE', count: '12' }],
                    });
                }
                if (sql.includes('sum(size)')) {
                    return Promise.resolve({ rows: [{ size_bytes: '4096' }] });
                }
                if (sql.includes('cluster_sessions')) {
                    return Promise.resolve({ rows: [{ count: '3' }] });
                }
                if (sql.includes('ORDER BY size DESC')) {
                    return Promise.resolve({
                        rows: [{ name: 'users', size_bytes: '2048' }],
                    });
                }
                return Promise.resolve({ rows: [] });
            });

            const metrics = await strategy.getDatabaseMetrics(mockPool);

            const executedSql = mockPool.query.mock.calls
                .map((call: unknown[]) => String(call[0]))
                .join('\n');
            expect(executedSql).not.toContain('pg_database_size');
            expect(executedSql).not.toContain('pg_stat_activity');
            expect(executedSql).not.toContain('pg_statio_user_tables');
            expect(executedSql).toContain('crdb_internal');

            expect(metrics).toEqual({
                tableCount: 12,
                sizeBytes: 4096,
                activeConnections: 3,
                topTables: [{ name: 'users', sizeBytes: 2048 }],
                tableTypes: [{ type: 'BASE TABLE', count: 12 }],
            });
        });

        it('degrades gracefully when crdb_internal is unavailable', async () => {
            mockPool.query.mockImplementation((sql: string) => {
                if (sql.includes('count(*) as table_count')) {
                    return Promise.resolve({ rows: [{ table_count: '5' }] });
                }
                if (sql.includes('GROUP BY table_type')) {
                    return Promise.resolve({
                        rows: [{ type: 'BASE TABLE', count: '5' }],
                    });
                }
                return Promise.reject(new Error('relation "crdb_internal" does not exist'));
            });

            const metrics = await strategy.getDatabaseMetrics(mockPool);

            expect(metrics.tableCount).toBe(5);
            expect(metrics.sizeBytes).toBe(0);
            expect(metrics.activeConnections).toBe(0);
            expect(metrics.topTables).toEqual([]);
        });
    });
});
