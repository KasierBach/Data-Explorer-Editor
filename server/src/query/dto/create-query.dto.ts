import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class CreateQueryDto {
    @IsUUID()
    @IsNotEmpty()
    connectionId: string;

    @IsString()
    @IsNotEmpty()
    sql: string;

    @IsString()
    @IsOptional()
    database?: string;
}
