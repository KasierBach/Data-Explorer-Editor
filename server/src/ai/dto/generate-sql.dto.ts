import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  Validate,
  MaxLength,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import type {
  AiChatMode,
  AiRoutingMode,
  ChatHistoryMessage,
} from '../ai.types';
import { AiProviderCapabilitiesDto } from './ai-provider-connection.dto';
import {
  AI_INPUT_BOUNDS,
  AiImageBoundsConstraint,
  AiInputBoundsConstraint,
  AiPdfBoundsConstraint,
} from '../ai-input-bounds';

class ChatHistoryMessageDto implements ChatHistoryMessage {
  @IsString()
  @IsIn(['user', 'ai'])
  role: 'user' | 'ai';

  @IsString()
  @IsNotEmpty()
  content: string;
}
class AiDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsIn(['application/pdf'])
  mimeType: 'application/pdf';

  @IsString()
  @MaxLength(AI_INPUT_BOUNDS.maxPdfDataUrlCharacters)
  @Validate(AiPdfBoundsConstraint)
  data: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(AI_INPUT_BOUNDS.maxPdfBytes)
  size?: number;
}

export class AiProviderOverrideDto {
  @IsString()
  @IsIn(['openai-compatible'])
  type: 'openai-compatible';

  @IsString()
  @IsOptional()
  @MaxLength(100)
  @IsUUID()
  providerId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  baseUrl?: string;

  @IsString()
  @IsOptional()
  @MaxLength(4000)
  apiKey?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  model: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AiProviderCapabilitiesDto)
  capabilities?: AiProviderCapabilitiesDto;
}

export class GenerateSqlDto {
  @IsNotEmpty()
  @IsString()
  @Validate(AiInputBoundsConstraint)
  connectionId: string;

  @IsOptional()
  @IsString()
  database?: string;

  @IsNotEmpty()
  @IsString()
  prompt: string;

  @IsOptional()
  @IsString()
  @MaxLength(AI_INPUT_BOUNDS.maxImageDataUrlCharacters)
  @Validate(AiImageBoundsConstraint)
  image?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AiDocumentDto)
  document?: AiDocumentDto;

  @IsOptional()
  @IsString()
  context?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  @IsIn(['planning', 'fast'])
  mode?: AiChatMode;

  @IsOptional()
  @IsString()
  @IsIn(['auto', 'fast', 'best', 'gemini-only'])
  routingMode?: AiRoutingMode;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatHistoryMessageDto)
  history?: ChatHistoryMessageDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => AiProviderOverrideDto)
  providerOverride?: AiProviderOverrideDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  disabledProviders?: string[];

  @IsOptional()
  @IsString()
  fallbackProvider?: string;
}
