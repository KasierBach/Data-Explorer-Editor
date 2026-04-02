import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class StartMigrationDto {
    @IsString()
    @IsNotEmpty()
    sourceConnectionId: string;

    @IsString()
    @IsOptional()
    sourceSchema: string;

    @IsString()
    @IsNotEmpty()
    sourceTable: string;

    @IsString()
    @IsNotEmpty()
    targetConnectionId: string;

    @IsString()
    @IsOptional()
    targetSchema: string;

    @IsString()
    @IsNotEmpty()
    targetTable: string;
}
