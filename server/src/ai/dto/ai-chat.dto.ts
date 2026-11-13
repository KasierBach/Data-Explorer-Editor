import {
  Equals,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
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

export class AddMessageDto extends AiMessageDto {
  @IsUUID()
  @IsOptional()
  clientMessageId?: string;

  // Chat-level optimistic concurrency, also usable by a delayed AI final save.
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  @IsOptional()
  expectedUpdatedAt?: string;

  // Decorated forbidden fields survive whitelist processing so actor spoofing
  // is rejected even when a global ValidationPipe runs before controller pipes.
  @Equals(undefined, { message: 'Actor identity comes from authentication' })
  userId?: never;

  @Equals(undefined, { message: 'Actor identity comes from authentication' })
  actorId?: never;

  @Equals(undefined, { message: 'Actor identity comes from authentication' })
  user?: never;

  @Equals(undefined, { message: 'Actor identity comes from authentication' })
  actor?: never;
}

export class EditMessageAndTruncateDto extends AddMessageDto {}
