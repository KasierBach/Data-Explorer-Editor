import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateSavedQueryDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsString()
  sql: string;

  @IsString()
  @IsOptional()
  database?: string;

  @IsString()
  @IsOptional()
  connectionId?: string;

  @IsString()
  @IsOptional()
  organizationId?: string;

  @IsString()
  @IsIn(['private', 'workspace'])
  @IsOptional()
  visibility?: 'private' | 'workspace';

  @IsString()
  @IsOptional()
  @MaxLength(80)
  folderId?: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;
}
