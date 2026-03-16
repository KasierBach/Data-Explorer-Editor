import { IsString } from 'class-validator';

export class UpdateBillingDto {
    @IsString()
    plan: string;

    @IsString()
    paymentMethod: string;
}
