export class Connection {
    id: string;
    name: string;
    type: 'postgres' | 'mysql' | 'sqlite';
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    database?: string;
    showAllDatabases: boolean;
    createdAt: Date;
}
