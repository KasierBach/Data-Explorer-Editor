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
  @IsIn(['private', 'team', 'workspace'])
  visibility?: 'private' | 'team' | 'workspace';

  @IsOptional()
  @IsString()
  connectionId?: string;

  @IsOptional()
  @IsString()
  database?: string;
}
