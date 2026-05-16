import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SchemaOperation } from './schema-operations.types';

export class UpdateSchemaDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsString()
  @IsOptional()
  database?: string;

  @IsString()
  @IsNotEmpty()
  schema!: string;

  @IsString()
  @IsNotEmpty()
  table!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  operations!: SchemaOperation[];
}
