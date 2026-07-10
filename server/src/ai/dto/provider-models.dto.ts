import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ProviderModelsDto {
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  baseUrl?: string;

  @IsString()
  @IsOptional()
  @MaxLength(4000)
  apiKey?: string;
}
