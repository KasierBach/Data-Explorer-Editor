import { IsString, IsNotEmpty } from 'class-validator';

export class StartMigrationDto {
    @IsString()
    @IsNotEmpty()
    sourceConnectionId: string;

    @IsString()
    @IsNotEmpty()
    sourceSchema: string;

    @IsString()
    @IsNotEmpty()
    sourceTable: string;

    @IsString()
    @IsNotEmpty()
    targetConnectionId: string;

    @IsString()
    @IsNotEmpty()
    targetSchema: string;

    @IsString()
    @IsNotEmpty()
    targetTable: string;
}
