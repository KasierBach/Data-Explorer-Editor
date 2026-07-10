import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class ClearSchemaCacheDto {
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
}
