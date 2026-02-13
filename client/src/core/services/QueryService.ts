import { useAppStore } from './store';

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
    | { type: 'drop_pk' }
    | { type: 'add_fk'; name: string; columns: string[]; refTable: string; refColumns: string[]; onDelete?: string; onUpdate?: string }
    | { type: 'drop_fk'; name: string };

const BASE_URL = 'http://localhost:3000/api';

const getHeaders = () => {
    const token = useAppStore.getState().accessToken;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
};

export const queryService = {
    executeQuery: async (payload: { connectionId: string; sql: string; database?: string }) => {
        const response = await fetch(`${BASE_URL}/query`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error(await response.text());
        return response.json();
    },

    updateRow: async (payload: any) => {
        const response = await fetch(`${BASE_URL}/query/row`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error(await response.text());
        return response.json();
    },

    updateSchema: async (payload: UpdateSchemaDto) => {
        const response = await fetch(`${BASE_URL}/query/schema`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error(await response.text());
        return response.json();
    },

    createDatabase: async (connectionId: string, name: string) => {
        const response = await fetch(`${BASE_URL}/query/database`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ connectionId, name }),
        });
        if (!response.ok) throw new Error(await response.text());
        return response.json();
    },

    dropDatabase: async (connectionId: string, name: string) => {
        const response = await fetch(`${BASE_URL}/query/database`, {
            method: 'DELETE',
            headers: getHeaders(),
            body: JSON.stringify({ connectionId, name }),
        });
        if (!response.ok) throw new Error(await response.text());
        return response.json();
    }
};
