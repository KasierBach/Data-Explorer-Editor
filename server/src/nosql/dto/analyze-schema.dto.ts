import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class AnalyzeSchemaDto {
  @IsUUID()
  @IsNotEmpty()
  connectionId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  database: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  collection: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  sampleSize?: number;

  @IsBoolean()
  @IsOptional()
  refresh?: boolean;
}
