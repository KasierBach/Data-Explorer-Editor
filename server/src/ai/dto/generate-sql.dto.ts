import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GenerateSqlDto {
    @IsNotEmpty()
    @IsString()
    connectionId: string;

    @IsOptional()
    @IsString()
    database?: string;

    @IsNotEmpty()
    @IsString()
    prompt: string;

    @IsOptional()
    @IsString()
    image?: string; // base64 encoded image data

    @IsOptional()
    @IsString()
    context?: string; // additional context (SQL, table schema, etc.)
}
