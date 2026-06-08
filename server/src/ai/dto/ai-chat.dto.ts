import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import type { PersistedAiMessagePayload } from '../ai.types';

export class CreateAiChatDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  connectionId?: string;

  @IsString()
  @IsOptional()
  database?: string;
}

export class UpdateAiChatDto {
  @IsString()
  title: string;
}

export class AiMessageDto {
  @IsString()
  @IsIn(['user', 'ai'])
  role: 'user' | 'ai';

  @IsString()
  content: string;

  @IsString()
  @IsOptional()
  sql?: string;

  @IsString()
  @IsOptional()
  explanation?: string;

  @IsBoolean()
  @IsOptional()
  error?: boolean;

  @IsOptional()
  attachments?: PersistedAiMessagePayload;
}

export class AddMessageDto extends AiMessageDto {}
