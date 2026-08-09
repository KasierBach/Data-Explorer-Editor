import { create } from 'zustand';
import { describe, expect, it } from 'vitest';
import { createNoSqlSlice, type NoSqlSlice } from './nosqlSlice';

const createStore = () => create<NoSqlSlice>()(createNoSqlSlice);

describe('createNoSqlSlice', () => {
    it('restores query, view and pagination for each collection workspace', () => {
        const store = createStore();

        store.getState().setNosqlActiveConnectionId('mongo-1');
        store.getState().setNosqlDatabase('warehouse');
        store.getState().setNosqlCollection('products');
        store.getState().setNosqlMqlQuery('{"action":"find","collection":"products","filter":{"active":true}}');
        store.getState().setNosqlViewMode('grid');
        store.getState().setNosqlPagination(3, 100);

        store.getState().setNosqlCollection('orders');
        expect(store.getState().nosqlPageIndex).toBe(0);
        expect(store.getState().nosqlPageSize).toBe(50);

        store.getState().setNosqlCollection('products');
        expect(store.getState().nosqlMqlQuery).toContain('"active":true');
        expect(store.getState().nosqlViewMode).toBe('grid');
        expect(store.getState().nosqlPageIndex).toBe(3);
        expect(store.getState().nosqlPageSize).toBe(100);
    });

    it('returns to the first page when the query changes', () => {
        const store = createStore();
        store.getState().setNosqlActiveConnectionId('mongo-1');
        store.getState().setNosqlCollection('products');
        store.getState().setNosqlPagination(8, 500);

        store.getState().setNosqlMqlQuery('{"action":"find","collection":"products"}');

        expect(store.getState().nosqlPageIndex).toBe(0);
        expect(store.getState().nosqlPageSize).toBe(500);
    });
});
