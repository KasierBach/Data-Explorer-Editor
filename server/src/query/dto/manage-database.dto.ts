import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class ManageDatabaseDto {
  @IsUUID()
  @IsNotEmpty()
  connectionId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  name: string;
}
