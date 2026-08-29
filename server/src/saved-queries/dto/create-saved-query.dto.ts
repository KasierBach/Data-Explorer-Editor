import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSavedQueryDto {
  @ApiProperty({ maxLength: 120, description: 'Saved query name' })
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiProperty({ description: 'SQL statement to save' })
  @IsString()
  sql: string;

  @ApiPropertyOptional({ description: 'Database the query targets' })
  @IsString()
  @IsOptional()
  database?: string;

  @ApiPropertyOptional({ description: 'Connection the query belongs to' })
  @IsString()
  @IsOptional()
  connectionId?: string;

  @ApiPropertyOptional({ description: 'Organization for workspace visibility' })
  @IsString()
  @IsOptional()
  organizationId?: string;

  @ApiPropertyOptional({
    enum: ['private', 'workspace'],
    description: 'Who can access the saved query',
  })
  @IsString()
  @IsIn(['private', 'workspace'])
  @IsOptional()
  visibility?: 'private' | 'workspace';

  @ApiPropertyOptional({
    maxLength: 80,
    description: 'Folder to organize the query into',
  })
  @IsString()
  @IsOptional()
  @MaxLength(80)
  folderId?: string;

  @ApiPropertyOptional({
    type: [String],
    maxItems: 10,
    description: 'Tags for search and filtering',
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({
    maxLength: 1000,
    description: 'Human-readable description',
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;
}
