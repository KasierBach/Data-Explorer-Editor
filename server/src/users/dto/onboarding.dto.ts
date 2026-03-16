import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class OnboardingDto {
    @IsString()
    @IsNotEmpty()
    username: string;

    @IsString()
    @IsNotEmpty()
    jobRole: string;

    @IsString()
    @IsOptional()
    phoneNumber?: string;

    @IsString()
    @IsOptional()
    address?: string;
}
