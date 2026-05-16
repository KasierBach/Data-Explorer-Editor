import {
  IsString,
  IsBoolean,
  IsArray,
  IsOptional,
  IsIn,
} from 'class-validator';

export type SchemaOperationType =
  | 'add_column'
  | 'drop_column'
  | 'alter_column_type'
  | 'rename_column'
  | 'add_pk'
  | 'drop_pk'
  | 'add_fk'
  | 'drop_fk';

export class AddColumnOperation {
  @IsIn(['add_column'])
  type!: 'add_column';

  @IsString()
  name!: string;

  @IsString()
  dataType!: string;

  @IsBoolean()
  @IsOptional()
  isNullable?: boolean;
}

export class DropColumnOperation {
  @IsIn(['drop_column'])
  type!: 'drop_column';

  @IsString()
  name!: string;
}

export class AlterColumnTypeOperation {
  @IsIn(['alter_column_type'])
  type!: 'alter_column_type';

  @IsString()
  name!: string;

  @IsString()
  newType!: string;
}

export class RenameColumnOperation {
  @IsIn(['rename_column'])
  type!: 'rename_column';

  @IsString()
  name!: string;

  @IsString()
  newName!: string;
}

export class AddPrimaryKeyOperation {
  @IsIn(['add_pk'])
  type!: 'add_pk';

  @IsArray()
  @IsString({ each: true })
  columns!: string[];
}

export class DropPrimaryKeyOperation {
  @IsIn(['drop_pk'])
  type!: 'drop_pk';

  @IsString()
  @IsOptional()
  constraintName?: string;
}

export class AddForeignKeyOperation {
  @IsIn(['add_fk'])
  type!: 'add_fk';

  @IsString()
  name!: string;

  @IsArray()
  @IsString({ each: true })
  columns!: string[];

  @IsString()
  refTable!: string;

  @IsArray()
  @IsString({ each: true })
  refColumns!: string[];
}

export class DropForeignKeyOperation {
  @IsIn(['drop_fk'])
  type!: 'drop_fk';

  @IsString()
  name!: string;
}

export type SchemaOperation =
  | AddColumnOperation
  | DropColumnOperation
  | AlterColumnTypeOperation
  | RenameColumnOperation
  | AddPrimaryKeyOperation
  | DropPrimaryKeyOperation
  | AddForeignKeyOperation
  | DropForeignKeyOperation;
