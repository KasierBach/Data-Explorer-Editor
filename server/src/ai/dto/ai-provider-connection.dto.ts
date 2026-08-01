import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class AiProviderCapabilitiesDto {
  @IsBoolean()
  @IsOptional()
  vision?: boolean;

  @IsBoolean()
  @IsOptional()
  document?: boolean;
}

export class SaveAiProviderConnectionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsIn(['openai-compatible'])
  @IsOptional()
  type?: 'openai-compatible';

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  baseUrl: string;

  @IsString()
  @IsOptional()
  @MaxLength(4000)
  apiKey?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  model: string;

  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  @IsOptional()
  models?: string[];

  @ValidateNested()
  @Type(() => AiProviderCapabilitiesDto)
  @IsOptional()
  capabilities?: AiProviderCapabilitiesDto;
}

export class TestAiProviderConnectionDto extends SaveAiProviderConnectionDto {}
