import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  theme?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  failedQueryAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  productUpdates?: boolean;

  @IsOptional()
  @IsBoolean()
  securityAlerts?: boolean;
}
