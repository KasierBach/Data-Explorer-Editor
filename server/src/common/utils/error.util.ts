/**
 * Shared error handling utilities for consistent error processing across services.
 */

/**
 * Extracts a human-readable message from an unknown error value.
 * Replaces the repeated pattern: `error instanceof Error ? error.message : String(error)`
 */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Checks whether a given error is a NestJS ForbiddenException.
 * Useful for re-throwing auth/permission errors while wrapping others.
 */
export function isForbiddenException(error: unknown): boolean {
  if (error == null || typeof error !== 'object') return false;
  const ctor = error.constructor;
  return ctor?.name === 'ForbiddenException';
}
