import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import type { RowIdentity } from '../../database-strategies/database-strategy.interface';

export class DeleteRowsDto {
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

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  pkValues: any[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  identities?: RowIdentity[];
}
