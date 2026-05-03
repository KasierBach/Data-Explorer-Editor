import { IsOptional, IsString } from 'class-validator';

export class AssignResourceTeamspaceDto {
  @IsString()
  @IsOptional()
  teamspaceId?: string | null;
}
