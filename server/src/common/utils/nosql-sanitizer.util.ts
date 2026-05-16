import { ForbiddenException } from '@nestjs/common';

/**
 * Dangerous NoSQL operators that could lead to Server-Side JavaScript Execution
 * or Resource Exhaustion.
 */
const BANNED_OPERATORS = new Set([
  '$where',
  '$function',
  '$accumulator',
  '$jsMode',
  '$query',
  '$eval',
  '$mapReduce',
]);

const MAX_DEPTH = 10;

/**
 * Recursively scans an object for NoSQL injection patterns.
 * Strips or throws error if banned operators are found.
 */
export function sanitizeNoSql(obj: any, depth = 0): any {
  if (depth > MAX_DEPTH) {
    throw new ForbiddenException(
      'Query quá sâu hoặc chứa vòng lặp (NoSQL security).',
    );
  }

  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeNoSql(item, depth + 1));
  }

  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Check if key is a banned operator
    if (BANNED_OPERATORS.has(key)) {
      throw new ForbiddenException(
        `Sử dụng toán tử NoSQL bị cấm: ${key} (Bảo mật NoSQL).`,
      );
    }

    // Check for potential nested injections or ReDoS characters in keys if needed
    // But mainly we focus on operator-based injection

    sanitized[key] = sanitizeNoSql(value, depth + 1);
  }

  return sanitized;
}

/**
 * Validates the top-level structure of a NoSQL request.
 */
export function validateNoSqlPayload(payload: any) {
  if (!payload || typeof payload !== 'object') {
    throw new ForbiddenException('NoSQL payload must be an object.');
  }

  const allowedActions = [
    'find',
    'aggregate',
    'insertOne',
    'insertMany',
    'updateOne',
    'updateMany',
    'deleteOne',
    'deleteMany',
    'count',
    'distinct',
  ];

  if (!payload.action || !allowedActions.includes(payload.action)) {
    throw new ForbiddenException(
      `Hành động NoSQL không hợp lệ: ${payload.action}`,
    );
  }

  if (!payload.collection || typeof payload.collection !== 'string') {
    throw new ForbiddenException(
      'Collection name is required and must be a string.',
    );
  }
}
