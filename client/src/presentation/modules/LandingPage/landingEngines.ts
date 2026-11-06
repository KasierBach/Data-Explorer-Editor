import { SiClickhouse, SiCockroachlabs, SiMariadb, SiMongodb, SiMysql, SiPostgresql, SiRedis, SiSqlite } from 'react-icons/si';
import { DiMsqlServer } from 'react-icons/di';

export const landingEngines = [
    { name: 'PostgreSQL', icon: SiPostgresql, color: '#60a5fa' },
    { name: 'MySQL', icon: SiMysql, color: '#38bdf8' },
    { name: 'MongoDB', icon: SiMongodb, color: '#4ade80' },
    { name: 'Redis', icon: SiRedis, color: '#fb7185' },
    { name: 'CockroachDB', icon: SiCockroachlabs, color: '#a78bfa' },
    { name: 'MariaDB', icon: SiMariadb, color: '#c4b5fd' },
    { name: 'SQL Server', icon: DiMsqlServer, color: '#f87171' },
    { name: 'SQLite', icon: SiSqlite, color: '#67e8f9' },
    { name: 'ClickHouse', icon: SiClickhouse, color: '#fde047' },
];
