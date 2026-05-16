import { apiService } from './api.service';
import type { DatabaseValue, QueryResult, RowData } from '../domain/entities';
import type { MutationResult } from '../domain/database-adapter.interface';

export interface UpdateSchemaDto {
    connectionId: string;
    database?: string;
    schema?: string;
    table?: string;
    operations: SchemaOperation[];
}

interface ExecuteQueryPayload {
    connectionId: string;
    sql: string;
    database?: string;
}

interface UpdateRowPayload {
    connectionId: string;
    database?: string;
    schema: string;
    table: string;
    pkColumn: string;
    pkValue: DatabaseValue;
    updates: RowData;
}

interface ImportDataPayload {
    connectionId: string;
    schema: string;
    table: string;
    data: RowData[];
}

export type SchemaOperation =
    | { type: 'add_column'; name: string; dataType: string; isNullable?: boolean }
    | { type: 'drop_column'; name: string }
    | { type: 'alter_column_type'; name: string; newType: string }
    | { type: 'rename_column'; name: string; newName: string }
    | { type: 'add_pk'; columns: string[] }
    | { type: 'drop_pk'; name?: string; constraintName?: string }
    | { type: 'add_fk'; name: string; columns: string[]; refTable: string; refColumns: string[]; onDelete?: string; onUpdate?: string }
    | { type: 'drop_fk'; name: string; constraintName?: string };

export const queryService = {
    executeQuery: async (payload: ExecuteQueryPayload) => {
        return await apiService.post<QueryResult>('/query', payload);
    },

    updateRow: async (payload: UpdateRowPayload) => {
        return await apiService.patch<MutationResult>('/query/row', payload);
    },

    updateSchema: async (payload: UpdateSchemaDto) => {
        return await apiService.post<MutationResult>('/query/schema', payload);
    },

    createDatabase: async (connectionId: string, name: string) => {
        return await apiService.post<MutationResult>('/query/database', { connectionId, name });
    },

    dropDatabase: async (connectionId: string, name: string) => {
        // apiService.delete takes headers as 2nd arg. 
        // Our backend expects connectionId/name in the body for this particular DELETE 
        // but apiService.delete doesn't take a body. 
        // We can use apiService.request
        return await apiService.request<MutationResult>('/query/database', {
            method: 'DELETE',
            body: JSON.stringify({ connectionId, name })
        });
    },

    importData: async (payload: ImportDataPayload) => {
        return await apiService.post<MutationResult>('/query/import', payload);
    }
};
