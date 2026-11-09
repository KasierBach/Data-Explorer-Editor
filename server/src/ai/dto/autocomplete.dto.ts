import { Type } from 'class-transformer';
import { IsArray, IsString, IsOptional, ValidateNested } from 'class-validator';
import { AiProviderOverrideDto } from './generate-sql.dto';

export class AutocompleteDto {
  @IsString()
  connectionId: string;

  @IsOptional()
  @IsString()
  database?: string;

  @IsString()
  beforeCursor: string;

  @IsOptional()
  @IsString()
  afterCursor?: string;

  @IsOptional()
  @IsString()
  context?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  disabledProviders?: string[];

  @IsOptional()
  @IsString()
  fallbackProvider?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AiProviderOverrideDto)
  providerOverride?: AiProviderOverrideDto;
}
