import { IsString, IsOptional } from 'class-validator';

export class AutocompleteDto {
    @IsString()
    connectionId: string;

    @IsOptional()
    @IsString()
    database?: string;

    @IsString()
    beforeCursor: string;

    @IsOptional()
    @IsString()
    afterCursor?: string;

    @IsOptional()
    @IsString()
    context?: string;
}
