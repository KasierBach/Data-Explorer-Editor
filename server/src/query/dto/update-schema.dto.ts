export class UpdateSchemaDto {
    connectionId: string;
    database?: string;
    schema?: string;
    table: string;
    operations: SchemaOperation[];
}

export type SchemaOperation =
    | { type: 'add_column', name: string, dataType: string, isNullable?: boolean }
    | { type: 'drop_column', name: string }
    | { type: 'alter_column_type', name: string, newType: string }
    | { type: 'rename_column', name: string, newName: string }
    | { type: 'add_pk', columns: string[] }
    | { type: 'drop_pk', constraintName?: string }
    | { type: 'add_fk', name: string, columns: string[], refTable: string, refColumns: string[] }
    | { type: 'drop_fk', name: string };
