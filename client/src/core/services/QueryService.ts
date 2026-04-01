import { apiService } from './api.service';

export interface UpdateSchemaDto {
    connectionId: string;
    database?: string;
    schema?: string;
    table?: string;
    operations: SchemaOperation[];
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
    executeQuery: async (payload: { connectionId: string; sql: string; database?: string }) => {
        return await apiService.post<any>('/query', payload);
    },

    updateRow: async (payload: any) => {
        return await apiService.patch<any>('/query/row', payload);
    },

    updateSchema: async (payload: UpdateSchemaDto) => {
        return await apiService.post<any>('/query/schema', payload);
    },

    createDatabase: async (connectionId: string, name: string) => {
        return await apiService.post<any>('/query/database', { connectionId, name });
    },

    dropDatabase: async (connectionId: string, name: string) => {
        // apiService.delete takes headers as 2nd arg. 
        // Our backend expects connectionId/name in the body for this particular DELETE 
        // but apiService.delete doesn't take a body. 
        // We can use apiService.request
        return await apiService.request<any>('/query/database', {
            method: 'DELETE',
            body: JSON.stringify({ connectionId, name })
        });
    },

    importData: async (payload: { connectionId: string; schema: string; table: string; data: any[] }) => {
        return await apiService.post<any>('/query/import', payload);
    }
};
