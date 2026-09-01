import {
  IsString,
  IsInt,
  IsOptional,
  IsIn,
  IsNotEmpty,
  IsBoolean,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsValidHost } from '../../common/decorators/is-valid-host.decorator';

export class CreateConnectionDto {
  @ApiProperty({
    example: 'Production Analytics',
    description: 'Display name for the connection',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    enum: [
      'postgres',
      'cockroach',
      'mysql',
      'mariadb',
      'mssql',
      'sqlite',
      'clickhouse',
      'mock',
      'mongodb',
      'mongodb+srv',
    ],
    description: 'Database engine type',
  })
  @IsString()
  @IsIn([
    'postgres',
    'cockroach',
    'mysql',
    'mariadb',
    'mssql',
    'sqlite',
    'clickhouse',
    'mock',
    'mongodb',
    'mongodb+srv',
  ])
  type:
    | 'postgres'
    | 'cockroach'
    | 'mysql'
    | 'mariadb'
    | 'mssql'
    | 'sqlite'
    | 'clickhouse'
    | 'mock'
    | 'mongodb'
    | 'mongodb+srv';

  @ApiPropertyOptional({
    description:
      'Database host (required unless type is sqlite/mock; validated against SSRF)',
  })
  @ValidateIf(
    (dto: CreateConnectionDto) => dto.type !== 'sqlite' && dto.type !== 'mock',
  )
  @IsString()
  @IsNotEmpty()
  @IsValidHost({
    message: 'Host address is not allowed for security reasons (SSRF).',
  })
  host?: string;

  @ApiPropertyOptional({ example: 5432, description: 'Database port' })
  @IsInt()
  @IsOptional()
  port?: number;

  @ApiPropertyOptional({ description: 'Database user' })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiPropertyOptional({ description: 'Database password (encrypted at rest)' })
  @IsString()
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({
    description: 'Default database name (or file path for SQLite)',
  })
  @IsString()
  @IsOptional()
  database?: string;

  @ApiPropertyOptional({ description: 'List all databases on the server' })
  @IsOptional()
  showAllDatabases?: boolean;

  @ApiPropertyOptional({ description: 'Open the connection in read-only mode' })
  @IsBoolean()
  @IsOptional()
  readOnly?: boolean;

  @ApiPropertyOptional({ description: 'Allow DDL schema changes' })
  @IsBoolean()
  @IsOptional()
  allowSchemaChanges?: boolean;

  @ApiPropertyOptional({ description: 'Allow import/export operations' })
  @IsBoolean()
  @IsOptional()
  allowImportExport?: boolean;

  @ApiPropertyOptional({ description: 'Allow executing queries' })
  @IsBoolean()
  @IsOptional()
  allowQueryExecution?: boolean;

  @ApiPropertyOptional({
    description: 'Assign the connection to an organization',
  })
  @IsString()
  @IsOptional()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'SSH host for tunneling' })
  @IsString()
  @IsOptional()
  @IsValidHost({
    message: 'SSH host address is not allowed for security reasons (SSRF).',
  })
  sshHost?: string;

  @ApiPropertyOptional({ example: 22, description: 'SSH port' })
  @IsInt()
  @IsOptional()
  sshPort?: number;

  @ApiPropertyOptional({ description: 'SSH username' })
  @IsString()
  @IsOptional()
  sshUsername?: string;

  @ApiPropertyOptional({ description: 'SSH private key (encrypted at rest)' })
  @IsString()
  @IsOptional()
  sshPrivateKey?: string;

  @ApiPropertyOptional({ description: 'SSH passphrase (encrypted at rest)' })
  @IsString()
  @IsOptional()
  sshPassphrase?: string;

  @ApiPropertyOptional({
    enum: ['development', 'staging', 'production'],
    description: 'Environment classification tag',
    default: 'development',
  })
  @IsString()
  @IsOptional()
  @IsIn(['development', 'staging', 'production'])
  environment?: 'development' | 'staging' | 'production';
}
