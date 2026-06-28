import { Type } from 'class-transformer';
import { IsString, IsOptional, ValidateNested } from 'class-validator';
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
  @ValidateNested()
  @Type(() => AiProviderOverrideDto)
  providerOverride?: AiProviderOverrideDto;
}
