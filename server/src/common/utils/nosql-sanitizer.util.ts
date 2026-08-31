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
const MAX_ARRAY_LENGTH = 10_000;
const MAX_OBJECT_KEYS = 2_000;
const MAX_PIPELINE_STAGES = 100;

/**
 * Recursively scans an object for NoSQL injection patterns.
 * Strips or throws error if banned operators are found.
 */
export function sanitizeNoSql(obj: any, depth = 0): any {
  if (depth > MAX_DEPTH) {
    throw new ForbiddenException(
      'Query is too deep or contains a cycle (NoSQL security).',
    );
  }

  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    if (obj.length > MAX_ARRAY_LENGTH) {
      throw new ForbiddenException('NoSQL array exceeds the maximum size.');
    }
    return obj.map((item) => sanitizeNoSql(item, depth + 1));
  }

  const sanitized: Record<string, any> = {};
  if (Object.keys(obj).length > MAX_OBJECT_KEYS) {
    throw new ForbiddenException('NoSQL object contains too many fields.');
  }

  for (const [key, value] of Object.entries(obj)) {
    // Check if key is a banned operator
    if (BANNED_OPERATORS.has(key)) {
      throw new ForbiddenException(
        `Banned NoSQL operator used: ${key} (NoSQL security).`,
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
    throw new ForbiddenException(`Invalid NoSQL action: ${payload.action}`);
  }

  if (!payload.collection || typeof payload.collection !== 'string') {
    throw new ForbiddenException(
      'Collection name is required and must be a string.',
    );
  }

  if (payload.pipeline !== undefined) {
    if (
      !Array.isArray(payload.pipeline) ||
      payload.pipeline.length > MAX_PIPELINE_STAGES
    ) {
      throw new ForbiddenException(
        'MongoDB pipeline exceeds the maximum of 100 stages.',
      );
    }
  }

  if (payload.documents !== undefined) {
    if (
      !Array.isArray(payload.documents) ||
      payload.documents.length > MAX_ARRAY_LENGTH
    ) {
      throw new ForbiddenException(
        'MongoDB insertMany payload exceeds the maximum size.',
      );
    }
  }
}
