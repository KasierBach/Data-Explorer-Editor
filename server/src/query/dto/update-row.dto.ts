import { IsString, IsNotEmpty, IsObject, IsOptional } from 'class-validator';

export class UpdateRowDto {
    @IsString()
    @IsNotEmpty()
    connectionId: string;

    @IsString()
    @IsOptional()
    database?: string;

    @IsString()
    @IsNotEmpty()
    schema: string;

    @IsString()
    @IsNotEmpty()
    table: string;

    @IsString()
    @IsNotEmpty()
    pkColumn: string;

    @IsNotEmpty()
    pkValue: any;

    @IsObject()
    updates: Record<string, any>;
}
