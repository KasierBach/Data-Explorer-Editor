import { IsEnum } from 'class-validator';

export enum Role {
    USER = 'user',
    ADMIN = 'admin',
}

export class UpdateRoleDto {
    @IsEnum(Role)
    role: Role;
}
