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
  image?: string; // base64 encoded image data

  @IsOptional()
  @IsString()
  context?: string; // additional context (SQL, table schema, etc.)

  @IsOptional()
  @IsString()
  model?: string; // Specific AI model to use

  @IsOptional()
  @IsString()
  @IsIn(['planning', 'fast'])
  mode?: AiChatMode; // e.g. 'planning' or 'fast'

  @IsOptional()
  @IsString()
  @IsIn(['auto', 'fast', 'best', 'gemini-only'])
  routingMode?: AiRoutingMode; // e.g. 'auto', 'fast', 'best', 'gemini-only'

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatHistoryMessageDto)
  history?: ChatHistoryMessageDto[]; // Chat history for memory
}
