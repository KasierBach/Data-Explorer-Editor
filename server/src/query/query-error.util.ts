import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { getErrorMessage } from '../common/utils/error.util';

type ErrorKind =
  | 'syntax'
  | 'object'
  | 'validation'
  | 'conflict'
  | 'permission'
  | 'unavailable'
  | 'cancelled';
const nativeErrors: Record<string, Record<string, ErrorKind>> = {
  postgres: {
    '42601': 'syntax',
    '42P01': 'object',
    '42703': 'object',
    '23502': 'validation',
    '23514': 'validation',
    '23505': 'conflict',
    '23503': 'conflict',
    '42P07': 'conflict',
    '42501': 'permission',
    '57014': 'cancelled',
    '57P01': 'unavailable',
    '57P02': 'unavailable',
    '57P03': 'unavailable',
    '53300': 'unavailable',
  },
  mysql: {
    ER_PARSE_ERROR: 'syntax',
    ER_NO_SUCH_TABLE: 'object',
    ER_BAD_FIELD_ERROR: 'object',
    ER_BAD_NULL_ERROR: 'validation',
    ER_NO_DEFAULT_FOR_FIELD: 'validation',
    ER_TRUNCATED_WRONG_VALUE: 'validation',
    ER_TRUNCATED_WRONG_VALUE_FOR_FIELD: 'validation',
    ER_DATA_TOO_LONG: 'validation',
    ER_CHECK_CONSTRAINT_VIOLATED: 'validation',
    ER_DUP_ENTRY: 'conflict',
    ER_NO_REFERENCED_ROW_2: 'conflict',
    ER_ROW_IS_REFERENCED_2: 'conflict',
    ER_TABLE_EXISTS_ERROR: 'conflict',
    ER_TABLEACCESS_DENIED_ERROR: 'permission',
    ER_DBACCESS_DENIED_ERROR: 'permission',
    ER_ACCESS_DENIED_ERROR: 'unavailable',
    PROTOCOL_CONNECTION_LOST: 'unavailable',
    ER_CON_COUNT_ERROR: 'unavailable',
  },
  sqlite: {
    SQLITE_CONSTRAINT_UNIQUE: 'conflict',
    SQLITE_CONSTRAINT_PRIMARYKEY: 'conflict',
    SQLITE_CONSTRAINT_FOREIGNKEY: 'conflict',
    SQLITE_CONSTRAINT_NOTNULL: 'validation',
    SQLITE_CONSTRAINT_CHECK: 'validation',
    SQLITE_MISMATCH: 'validation',
    SQLITE_CANTOPEN: 'unavailable',
    SQLITE_IOERR: 'unavailable',
  },
  mssql: {
    '102': 'syntax',
    '156': 'syntax',
    '208': 'object',
    '207': 'object',
    '515': 'validation',
    '245': 'validation',
    '8114': 'validation',
    '2627': 'conflict',
    '2601': 'conflict',
    '547': 'conflict',
    '229': 'permission',
    ELOGIN: 'unavailable',
    ESOCKET: 'unavailable',
  },
  mongodb: {
    '2': 'validation',
    '9': 'syntax',
    '26': 'object',
    '11000': 'conflict',
  },
  clickhouse: {
    '62': 'syntax',
    '60': 'object',
    '47': 'object',
    '53': 'validation',
  },
};
const reasons: Record<ErrorKind, string> = {
  syntax: 'QUERY_SYNTAX_ERROR',
  object: 'QUERY_OBJECT_NOT_FOUND',
  validation: 'QUERY_VALIDATION_FAILED',
  conflict: 'QUERY_CONFLICT',
  permission: 'DATABASE_PERMISSION_DENIED',
  unavailable: 'DATABASE_UNAVAILABLE',
  cancelled: 'QUERY_CANCELLED',
};

export function queryDatabaseException(
  error: unknown,
  connectionType: string,
  fallback: string | { message: string; details?: Record<string, unknown> },
): HttpException {
  if (error instanceof HttpException) return error;
  const native = error && typeof error === 'object' ? error : {};
  const rawCode =
    'number' in native ? native.number : 'code' in native ? native.code : '';
  const code =
    typeof rawCode === 'string' || typeof rawCode === 'number'
      ? String(rawCode)
      : '';
  const engine =
    connectionType === 'mongodb+srv'
      ? 'mongodb'
      : connectionType === 'cockroach'
        ? 'postgres'
        : connectionType === 'mariadb'
          ? 'mysql'
          : connectionType;
  let kind: ErrorKind | undefined =
    Object.hasOwn(nativeErrors, engine) &&
    Object.hasOwn(nativeErrors[engine], code)
      ? nativeErrors[engine][code]
      : undefined;
  if (engine === 'postgres' && code.startsWith('22')) kind = 'validation';
  if (engine === 'postgres' && (code.startsWith('08') || code.startsWith('28')))
    kind = 'unavailable';
  if (
    [
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'EHOSTUNREACH',
    ].includes(code)
  )
    kind = 'unavailable';
  // SQLite/Redis do not provide a separate code for these native parser errors.
  if (engine === 'sqlite' && code === 'SQLITE_ERROR') {
    if (/^no such (table|column):/.test(getErrorMessage(error)))
      kind = 'object';
    else if (/syntax error/.test(getErrorMessage(error))) kind = 'syntax';
  }
  if (
    engine === 'redis' &&
    error instanceof Error &&
    error.name === 'ReplyError'
  ) {
    if (/^WRONGTYPE\b/.test(error.message)) kind = 'validation';
    else if (
      /^ERR (syntax error|unknown command|wrong number of arguments)/.test(
        error.message,
      )
    )
      kind = 'syntax';
  }
  const response = {
    ...(typeof fallback === 'string' ? { message: fallback } : fallback),
    reason: kind ? reasons[kind] : 'QUERY_EXECUTION_FAILED',
  };
  if (kind === 'unavailable')
    return new ServiceUnavailableException({
      message:
        'The database is unavailable. Inspect any writes before retrying.',
      reason: reasons[kind],
    });
  if (kind === 'permission') return new ForbiddenException(response);
  if (kind === 'conflict') return new ConflictException(response);
  if (kind) return new BadRequestException(response);
  return new InternalServerErrorException(response);
}
