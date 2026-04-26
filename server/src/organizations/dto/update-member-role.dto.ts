import { IsEnum, IsNotEmpty } from 'class-validator';
import { OrganizationRole } from '../entities/organization-role.enum';

export class UpdateMemberRoleDto {
  @IsEnum(OrganizationRole)
  @IsNotEmpty()
  role: OrganizationRole;
}
