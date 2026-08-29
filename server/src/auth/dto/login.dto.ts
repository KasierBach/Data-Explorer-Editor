import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Registered email address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'P@ssw0rd!',
    minLength: 6,
    description: 'Account password',
  })
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
