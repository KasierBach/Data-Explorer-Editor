import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';
import { OrganizationRole } from '../entities/organization-role.enum';

export class InviteMemberDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsEnum(OrganizationRole)
  role: OrganizationRole = OrganizationRole.MEMBER;
}
