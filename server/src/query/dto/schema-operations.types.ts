import {
  IsString,
  IsBoolean,
  IsArray,
  IsOptional,
  IsIn,
  Matches,
  MaxLength,
  MinLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ArrayMinSize,
} from 'class-validator';

const SQL_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_$]*$/;
const SQL_IDENTIFIER_MESSAGE =
  '$property must be a simple SQL identifier containing only letters, numbers, underscores, or dollar signs.';
const DATA_TYPE_PATTERN = /^[A-Za-z][A-Za-z0-9_\s(),.[\]]*$/;
const UNSAFE_DATA_TYPE_PATTERN =
  /(;|--|\/\*|\*\/|['"`\\]|\b(?:alter|create|drop|delete|insert|update|truncate|merge|grant|revoke|exec|execute|select|union|constraint|references|primary|foreign|default|check|comment|generated)\b)/i;

function hasBalancedParentheses(value: string): boolean {
  let depth = 0;
  for (const char of value) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
}

@ValidatorConstraint({ name: 'safeSchemaDataType', async: false })
class SafeSchemaDataTypeConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const normalized = value.trim();
    return (
      normalized.length >= 1 &&
      normalized.length <= 160 &&
      DATA_TYPE_PATTERN.test(normalized) &&
      !UNSAFE_DATA_TYPE_PATTERN.test(normalized) &&
      hasBalancedParentheses(normalized)
    );
  }

  defaultMessage(): string {
    return '$property must be a safe SQL data type without SQL clauses, comments, quotes, or statement separators.';
  }
}

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
  @MinLength(1)
  @MaxLength(128)
  @Matches(SQL_IDENTIFIER_PATTERN, { message: SQL_IDENTIFIER_MESSAGE })
  name!: string;

  @IsString()
  @Validate(SafeSchemaDataTypeConstraint)
  dataType!: string;

  @IsBoolean()
  @IsOptional()
  isNullable?: boolean;
}

export class DropColumnOperation {
  @IsIn(['drop_column'])
  type!: 'drop_column';

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  @Matches(SQL_IDENTIFIER_PATTERN, { message: SQL_IDENTIFIER_MESSAGE })
  name!: string;
}

export class AlterColumnTypeOperation {
  @IsIn(['alter_column_type'])
  type!: 'alter_column_type';

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  @Matches(SQL_IDENTIFIER_PATTERN, { message: SQL_IDENTIFIER_MESSAGE })
  name!: string;

  @IsString()
  @Validate(SafeSchemaDataTypeConstraint)
  newType!: string;
}

export class RenameColumnOperation {
  @IsIn(['rename_column'])
  type!: 'rename_column';

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  @Matches(SQL_IDENTIFIER_PATTERN, { message: SQL_IDENTIFIER_MESSAGE })
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  @Matches(SQL_IDENTIFIER_PATTERN, { message: SQL_IDENTIFIER_MESSAGE })
  newName!: string;
}

export class AddPrimaryKeyOperation {
  @IsIn(['add_pk'])
  type!: 'add_pk';

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(128, { each: true })
  @Matches(SQL_IDENTIFIER_PATTERN, {
    each: true,
    message: SQL_IDENTIFIER_MESSAGE,
  })
  columns!: string[];
}

export class DropPrimaryKeyOperation {
  @IsIn(['drop_pk'])
  type!: 'drop_pk';

  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(128)
  @Matches(SQL_IDENTIFIER_PATTERN, { message: SQL_IDENTIFIER_MESSAGE })
  constraintName?: string;
}

export class AddForeignKeyOperation {
  @IsIn(['add_fk'])
  type!: 'add_fk';

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  @Matches(SQL_IDENTIFIER_PATTERN, { message: SQL_IDENTIFIER_MESSAGE })
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(128, { each: true })
  @Matches(SQL_IDENTIFIER_PATTERN, {
    each: true,
    message: SQL_IDENTIFIER_MESSAGE,
  })
  columns!: string[];

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  @Matches(SQL_IDENTIFIER_PATTERN, { message: SQL_IDENTIFIER_MESSAGE })
  refTable!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(128, { each: true })
  @Matches(SQL_IDENTIFIER_PATTERN, {
    each: true,
    message: SQL_IDENTIFIER_MESSAGE,
  })
  refColumns!: string[];
}

export class DropForeignKeyOperation {
  @IsIn(['drop_fk'])
  type!: 'drop_fk';

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  @Matches(SQL_IDENTIFIER_PATTERN, { message: SQL_IDENTIFIER_MESSAGE })
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
