import { IsString, IsInt, IsOptional, IsIn, IsNotEmpty, IsBoolean } from 'class-validator';
import { IsValidHost } from '../../common/decorators/is-valid-host.decorator';

export class CreateConnectionDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsIn(['postgres', 'mysql', 'mssql', 'sqlite', 'clickhouse', 'mock', 'mongodb', 'mongodb+srv'])
    type: 'postgres' | 'mysql' | 'mssql' | 'sqlite' | 'clickhouse' | 'mock' | 'mongodb' | 'mongodb+srv';

    @IsString()
    @IsOptional()
    @IsValidHost({ message: 'Host address is not allowed for security reasons (SSRF).' })
    host?: string;

    @IsInt()
    @IsOptional()
    port?: number;

    @IsString()
    @IsOptional()
    username?: string;

    @IsString()
    @IsOptional()
    password?: string;

    @IsString()
    @IsOptional()
    database?: string;

    @IsOptional()
    showAllDatabases?: boolean;

    @IsBoolean()
    @IsOptional()
    readOnly?: boolean;

    @IsBoolean()
    @IsOptional()
    allowSchemaChanges?: boolean;

    @IsBoolean()
    @IsOptional()
    allowImportExport?: boolean;

    @IsBoolean()
    @IsOptional()
    allowQueryExecution?: boolean;

    @IsString()
    @IsOptional()
    organizationId?: string;
}
