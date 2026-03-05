import { IsString, IsNotEmpty, IsArray, IsOptional } from 'class-validator';

export class UpdateSchemaDto {
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

    @IsArray()
    operations: any[];
}
