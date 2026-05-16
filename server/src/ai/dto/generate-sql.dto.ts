import { IsNotEmpty, IsOptional, IsString, IsArray } from 'class-validator';

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
  mode?: string; // e.g. 'planning' or 'fast'

  @IsOptional()
  @IsString()
  routingMode?: string; // e.g. 'auto', 'fast', 'best', 'gemini-only'

  @IsOptional()
  @IsArray()
  history?: any[]; // Chat history for memory
}
