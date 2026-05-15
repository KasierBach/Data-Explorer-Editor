import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDashboardDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsIn(['private', 'workspace'])
  visibility?: 'private' | 'workspace';

  @IsOptional()
  @IsString()
  connectionId?: string;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsString()
  database?: string;
}
