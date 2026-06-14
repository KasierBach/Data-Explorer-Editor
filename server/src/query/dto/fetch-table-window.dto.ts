import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class FetchTableWindowDto {
  @IsUUID()
  @IsNotEmpty()
  connectionId: string;

  @IsString()
  @IsOptional()
  database?: string;

  @IsString()
  @IsOptional()
  schema?: string;

  @IsString()
  @IsNotEmpty()
  table: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  offset?: number;

  @IsBoolean()
  @IsOptional()
  includeTotalCount?: boolean;
}
