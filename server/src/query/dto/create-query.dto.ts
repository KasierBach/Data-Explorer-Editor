import { IsString, IsNotEmpty, IsUUID, IsOptional, IsInt, Min } from 'class-validator';

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

    @IsInt()
    @Min(1)
    @IsOptional()
    limit?: number;

    @IsInt()
    @Min(0)
    @IsOptional()
    offset?: number;
}
