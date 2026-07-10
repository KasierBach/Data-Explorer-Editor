import { IsNotEmpty, IsUUID } from 'class-validator';

export class SeedDataDto {
  @IsUUID()
  @IsNotEmpty()
  connectionId: string;
}
