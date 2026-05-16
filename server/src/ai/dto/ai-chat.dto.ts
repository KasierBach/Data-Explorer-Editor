import { IsString, IsOptional, IsBoolean } from 'class-validator';

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
  role: string;

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
  attachments?: any;
}

export class AddMessageDto extends AiMessageDto {}
