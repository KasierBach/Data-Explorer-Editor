import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
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

class AiProviderOverrideDto {
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
