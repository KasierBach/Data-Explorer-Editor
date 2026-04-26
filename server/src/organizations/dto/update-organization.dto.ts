import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateOrganizationDto {
  @IsString()
  @IsOptional()
  @Length(1, 100)
  name?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsOptional()
  settings?: Record<string, unknown>;
}
