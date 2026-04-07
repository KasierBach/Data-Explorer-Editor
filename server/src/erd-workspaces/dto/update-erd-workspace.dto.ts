import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateErdWorkspaceDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @IsString()
  connectionId?: string;

  @IsOptional()
  @IsString()
  database?: string;

  @IsOptional()
  @IsObject()
  layout?: Record<string, any>;
}
