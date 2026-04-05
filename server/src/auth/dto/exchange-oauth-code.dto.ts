import { IsNotEmpty, IsString } from 'class-validator';

export class ExchangeOauthCodeDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}
