import { IsString, IsNotEmpty, IsObject, IsOptional } from 'class-validator';

export class InsertRowDto {
  @IsString()
  @IsNotEmpty()
  connectionId: string;

  @IsString()
  @IsOptional()
  database?: string;

  @IsString()
  @IsNotEmpty()
  schema: string;

  @IsString()
  @IsNotEmpty()
  table: string;

  @IsObject()
  @IsNotEmpty()
  data: Record<string, any>;
}
