import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';
import { OrganizationRole } from '../entities/organization-role.enum';

export class InviteMemberDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsEnum(OrganizationRole)
  role: OrganizationRole = OrganizationRole.MEMBER;
}
