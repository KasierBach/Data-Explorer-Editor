export class UpdateRowDto {
    connectionId: string;
    database?: string;
    schema?: string;
    table: string;
    pkColumn: string;
    pkValue: any;
    updates: Record<string, any>;
}
