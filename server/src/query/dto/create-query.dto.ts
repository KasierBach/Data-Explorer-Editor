import { IsString, IsNotEmpty, IsUUID, IsOptional, IsInt, Min, MaxLength, IsBoolean } from 'class-validator';

export class CreateQueryDto {
    @IsUUID()
    @IsNotEmpty()
    connectionId: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(500000, { message: 'SQL query exceeds maximum allowed length (500,000 characters).' })
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

    /** Set to true to bypass the destructive query confirmation check */
    @IsBoolean()
    @IsOptional()
    confirmed?: boolean;
}
