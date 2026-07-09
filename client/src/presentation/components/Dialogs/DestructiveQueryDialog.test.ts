import { describe, expect, it } from 'vitest';
import {
    buildReviewContextLines,
    countObjectDependencies,
} from './DestructiveQueryDialog.utils';

const text = {
    contextTitle: 'Runtime context',
    contextLoading: 'Loading...',
    contextConnection: 'Connection',
    contextDatabase: 'Database',
    contextRows: (count: number) => `Rows: ${count}`,
    contextColumns: (count: number) => `Columns: ${count}`,
    contextIndexes: (count: number) => `Indexes: ${count}`,
    contextDependencies: (count: number) => `Dependencies: ${count}`,
    contextReadOnly: 'Read-only',
    contextSchemaChangesDisabled: 'Schema changes disabled',
    contextQueryExecutionDisabled: 'Query execution disabled',
};

describe('DestructiveQueryDialog helpers', () => {
    it('deduplicates related dependencies for the same object', () => {
        expect(countObjectDependencies([
            {
                constraint_name: 'fk_orders_customers',
                source_table: 'orders',
                source_column: 'customer_id',
                target_table: 'customers',
                target_column: 'id',
            },
            {
                constraint_name: 'fk_orders_customers',
                source_table: 'orders',
                source_column: 'billing_customer_id',
                target_table: 'customers',
                target_column: 'id',
            },
            {
                source_table: 'shipments',
                source_column: 'order_id',
                target_table: 'orders',
                target_column: 'id',
            },
        ], 'public.orders')).toBe(2);
    });

    it('builds readable runtime context lines from metadata and connection flags', () => {
        const lines = buildReviewContextLines({
            connection: {
                id: 'conn-1',
                name: 'Main DB',
                type: 'postgres',
                readOnly: true,
                allowSchemaChanges: false,
                allowQueryExecution: false,
            },
            database: 'analytics',
            context: {
                rowCount: 1200,
                columnCount: 8,
                indexCount: 2,
                dependencyCount: 3,
            },
            text,
        });

        expect(lines).toEqual([
            'Connection: Main DB (postgres)',
            'Database: analytics',
            'Rows: 1200',
            'Columns: 8',
            'Indexes: 2',
            'Dependencies: 3',
            'Read-only',
            'Schema changes disabled',
            'Query execution disabled',
        ]);
    });
});