import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  Matches,
  MaxLength,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import type {
  AiChatMode,
  AiRoutingMode,
  ChatHistoryMessage,
} from '../ai.types';

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
  @MaxLength(7_000_000)
  @Matches(/^data:application\/pdf;base64,[A-Za-z0-9+/=]+$/)
  data: string;
}

export class AiProviderOverrideDto {
  @IsString()
  @IsIn(['openai-compatible'])
  type: 'openai-compatible';

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  baseUrl: string;

  @IsString()
  @IsOptional()
  apiKey?: string;

  @IsString()
  @IsNotEmpty()
  model: string;
}

export class GenerateSqlDto {
  @IsNotEmpty()
  @IsString()
  connectionId: string;

  @IsOptional()
  @IsString()
  database?: string;

  @IsNotEmpty()
  @IsString()
  prompt: string;

  @IsOptional()
  @IsString()
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
}
