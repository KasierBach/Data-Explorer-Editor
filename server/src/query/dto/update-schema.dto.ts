import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  AddColumnOperation,
  AddForeignKeyOperation,
  AddPrimaryKeyOperation,
  AlterColumnTypeOperation,
  DropColumnOperation,
  DropForeignKeyOperation,
  DropPrimaryKeyOperation,
  RenameColumnOperation,
  SchemaOperation,
} from './schema-operations.types';

export class UpdateSchemaDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsString()
  @IsOptional()
  database?: string;

  @IsString()
  @IsNotEmpty()
  schema!: string;

  @IsString()
  @IsNotEmpty()
  table!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object, {
    discriminator: {
      property: 'type',
      subTypes: [
        { name: 'add_column', value: AddColumnOperation },
        { name: 'drop_column', value: DropColumnOperation },
        { name: 'alter_column_type', value: AlterColumnTypeOperation },
        { name: 'rename_column', value: RenameColumnOperation },
        { name: 'add_pk', value: AddPrimaryKeyOperation },
        { name: 'drop_pk', value: DropPrimaryKeyOperation },
        { name: 'add_fk', value: AddForeignKeyOperation },
        { name: 'drop_fk', value: DropForeignKeyOperation },
      ],
    },
    keepDiscriminatorProperty: true,
  })
  operations!: SchemaOperation[];
}
