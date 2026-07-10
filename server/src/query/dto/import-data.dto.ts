import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsObject,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class ImportDataDto {
  @IsUUID()
  @IsNotEmpty()
  connectionId: string;

  @IsString()
  @MaxLength(128)
  schema: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  table: string;

  @IsArray()
  @ArrayMaxSize(10000)
  @IsObject({ each: true })
  data: Record<string, unknown>[];
}
