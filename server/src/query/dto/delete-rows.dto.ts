import { IsString, IsNotEmpty, IsArray, IsOptional } from 'class-validator';

export class DeleteRowsDto {
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

    @IsArray()
    @IsNotEmpty()
    pkValues: any[];
}
