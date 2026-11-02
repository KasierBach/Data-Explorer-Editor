import {
  IsString,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsDefined,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import type { RowIdentity } from '../../database-strategies/database-strategy.interface';

export class UpdateRowDto {
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

  @IsString()
  @IsNotEmpty()
  pkColumn: string;

  @IsDefined()
  pkValue: any;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(16)
  identity?: RowIdentity;

  @IsObject()
  updates: Record<string, any>;
}
