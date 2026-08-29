import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsInt,
  Min,
  Max,
  MaxLength,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateQueryDto {
  @ApiProperty({ format: 'uuid', description: 'Target connection ID' })
  @IsUUID()
  @IsNotEmpty()
  connectionId: string;

  @ApiProperty({
    description:
      'SQL statement(s) to execute (multi-statement batches run in a single transaction)',
    maxLength: 500000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500000, {
    message: 'SQL query exceeds maximum allowed length (500,000 characters).',
  })
  sql: string;

  @ApiPropertyOptional({ description: 'Database override for the connection' })
  @IsString()
  @IsOptional()
  database?: string;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 50000,
    description: 'Max rows to return',
  })
  @IsInt()
  @Min(1)
  @Max(50_000)
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ minimum: 0, description: 'Row offset for pagination' })
  @IsInt()
  @Min(0)
  @IsOptional()
  offset?: number;

  @ApiPropertyOptional({
    description:
      'Set to true to bypass the destructive query confirmation check',
  })
  @IsBoolean()
  @IsOptional()
  confirmed?: boolean;

  @ApiPropertyOptional({
    description: 'Set to false when the caller already has a trusted row count',
  })
  @IsBoolean()
  @IsOptional()
  includeTotalCount?: boolean;
}
