import { PostgresStrategy } from './postgres.strategy';
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

describe('PostgresStrategy', () => {
    let strategy: PostgresStrategy;
    let mockPool: any;
    let mockClient: any;

    beforeEach(() => {
        strategy = new PostgresStrategy();
        mockClient = {
            query: jest.fn(),
            release: jest.fn(),
        };
        mockPool = new Pool();
        mockPool.connect.mockResolvedValue(mockClient);
        (Pool as unknown as jest.Mock).mockClear();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createPool', () => {
        it('should pass timeouts to the PG Pool configuration', () => {
            const config = {
                host: '127.0.0.1',
                port: 5432,
                username: 'postgres',
                password: 'password',
                database: 'test_db',
            };
            
            strategy.createPool(config);

            expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
                host: '127.0.0.1',
                statement_timeout: 30000,
                query_timeout: 30000,
                ssl: false,
            }));
        });
    });

    describe('executeQuery (OOM & Timeout Protections)', () => {
        it('should automatically append LIMIT 50000 to a bare SELECT query to prevent OOM', async () => {
            mockClient.query.mockResolvedValue({ rows: [], fields: [], rowCount: 0 });
            
            await strategy.executeQuery(mockPool, 'SELECT * FROM big_table');

            expect(mockClient.query).toHaveBeenCalledWith('SELECT * FROM big_table LIMIT 50000;');
        });

        it('should not append LIMIT if query already has a LIMIT clause', async () => {
            mockClient.query.mockResolvedValue({ rows: [], fields: [], rowCount: 0 });
            
            await strategy.executeQuery(mockPool, 'SELECT * FROM big_table LIMIT 10');

            expect(mockClient.query).toHaveBeenCalledWith('SELECT * FROM big_table LIMIT 10');
        });

        it('should not append LIMIT to non-SELECT queries (e.g. DELETE)', async () => {
            mockClient.query.mockResolvedValue({ rows: [], fields: [], rowCount: 5 });
            
            const result = await strategy.executeQuery(mockPool, "DELETE FROM users WHERE id > 100");

            expect(mockClient.query).toHaveBeenCalledWith("DELETE FROM users WHERE id > 100");
            expect(result.rowCount).toBe(5);
        });

        it('should slice the result array to 50000 max exactly as a secondary guard', async () => {
            // Mock returning an array of size 50001
            const massiveArray = new Array(50001).fill({ id: 1 });
            mockClient.query.mockResolvedValue({ rows: massiveArray, fields: [], rowCount: 50001 });
            
            const result = await strategy.executeQuery(mockPool, 'SELECT * FROM big_table');

            expect(result.rows.length).toBe(50000);
            expect(mockClient.release).toHaveBeenCalled();
        });
    });
});
