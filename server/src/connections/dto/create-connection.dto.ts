import { IsString, IsInt, IsOptional, IsIn, IsNotEmpty } from 'class-validator';

export class CreateConnectionDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsIn(['postgres', 'mysql', 'sqlite'])
    type: 'postgres' | 'mysql' | 'sqlite';

    @IsString()
    @IsOptional()
    host?: string;

    @IsInt()
    @IsOptional()
    port?: number;

    @IsString()
    @IsOptional()
    username?: string;

    @IsString()
    @IsOptional()
    password?: string;

    @IsString()
    @IsOptional()
    database?: string;

    @IsOptional()
    showAllDatabases?: boolean;
}
