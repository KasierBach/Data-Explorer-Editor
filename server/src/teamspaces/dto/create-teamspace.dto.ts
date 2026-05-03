import { IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class CreateTeamspaceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;
}
