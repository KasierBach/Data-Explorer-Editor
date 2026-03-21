import { useAppStore } from './store';
import { API_BASE_URL } from '../config/env';

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

const BASE_URL = API_BASE_URL;

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

const unwrap = async (response: Response) => {
    if (!response.ok) throw new Error(await response.text());
    const json = await response.json();
    return (json && typeof json === 'object' && 'success' in json && 'data' in json) ? json.data : json;
};

export const queryService = {
    executeQuery: async (payload: { connectionId: string; sql: string; database?: string }) => {
        const response = await fetch(`${BASE_URL}/query`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload),
        });
        return unwrap(response);
    },

    updateRow: async (payload: any) => {
        const response = await fetch(`${BASE_URL}/query/row`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify(payload),
        });
        return unwrap(response);
    },

    updateSchema: async (payload: UpdateSchemaDto) => {
        const response = await fetch(`${BASE_URL}/query/schema`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload),
        });
        return unwrap(response);
    },

    createDatabase: async (connectionId: string, name: string) => {
        const response = await fetch(`${BASE_URL}/query/database`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ connectionId, name }),
        });
        return unwrap(response);
    },

    dropDatabase: async (connectionId: string, name: string) => {
        const response = await fetch(`${BASE_URL}/query/database`, {
            method: 'DELETE',
            headers: getHeaders(),
            body: JSON.stringify({ connectionId, name }),
        });
        return unwrap(response);
    }
};
