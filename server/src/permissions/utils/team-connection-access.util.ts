import { ForbiddenException } from '@nestjs/common';
import type { OrganizationRole } from '../../organizations/entities/organization-role.enum';

export type RoleQueryMode = 'blocked' | 'readonly' | 'full';

/** Raw column shape of Connection.allowedDatabases (null = unrestricted). */
function parseAllowedDatabases(value: unknown): string[] | null {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) return null;
  const names = value.filter(
    (item): item is string => typeof item === 'string' && item.trim() !== '',
  );
  return names.length > 0 ? names.map((name) => name.trim()) : null;
}

/** Raw column shape of Connection.roleQueryModes (null = full for everyone). */
function parseRoleQueryModes(
  value: unknown,
): Partial<Record<OrganizationRole, RoleQueryMode>> | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return null;

  const modes: Partial<Record<OrganizationRole, RoleQueryMode>> = {};
  for (const [role, mode] of Object.entries(value)) {
    if (mode === 'blocked' || mode === 'readonly' || mode === 'full') {
      modes[role as OrganizationRole] = mode;
    }
  }
  return Object.keys(modes).length > 0 ? modes : null;
}

export interface ConnectionTeamRestrictions {
  allowedDatabases?: string[] | null;
  roleQueryModes?: unknown;
  /** Connection owner — restrictions never apply to the owner. */
  userId: string;
  organizationId?: string | null;
}

export interface TeamAccessContext {
  userId: string;
  role: OrganizationRole | null;
}

function normalizeDatabaseName(database?: string | null): string {
  return (database ?? '').trim();
}

/**
 * Enforces the per-connection team restrictions:
 * 1. Database whitelist — members may only reach databases on the list.
 * 2. Role query modes — members may be blocked or limited to read-only SQL.
 *
 * The connection owner always bypasses both checks.
 */
export function assertTeamConnectionAccess(
  connection: ConnectionTeamRestrictions,
  requester: TeamAccessContext,
  options: { database?: string | null; sql?: string; isReadOnlySql?: boolean },
): void {
  if (connection.userId === requester.userId) return;
  if (!requester.role) return;

  const database = normalizeDatabaseName(options.database);
  if (database) {
    const allowed = parseAllowedDatabases(connection.allowedDatabases);
    if (allowed && !allowed.includes(database)) {
      throw new ForbiddenException(
        `You do not have access to the database "${database}" on this connection.`,
      );
    }
  }

  const modes = parseRoleQueryModes(connection.roleQueryModes);
  if (!modes) return;
  const mode = modes[requester.role] ?? 'full';

  if (mode === 'blocked') {
    throw new ForbiddenException(
      'Your role does not have query access to this connection.',
    );
  }
  if (mode === 'readonly' && options.sql && options.isReadOnlySql === false) {
    throw new ForbiddenException(
      'Your role has read-only access to this connection; data-modifying queries are not allowed.',
    );
  }
}

export { parseAllowedDatabases, parseRoleQueryModes };
