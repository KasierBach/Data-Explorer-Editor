import { ForbiddenException } from '@nestjs/common';
import {
  assertTeamConnectionAccess,
  parseAllowedDatabases,
  parseRoleQueryModes,
} from './team-connection-access.util';
import { OrganizationRole } from '../../organizations/entities/organization-role.enum';

const OWNER_ID = 'owner-1';
const MEMBER_ID = 'member-1';

function makeConnection(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    userId: OWNER_ID,
    organizationId: 'org-1',
    allowedDatabases: null,
    roleQueryModes: null,
    ...overrides,
  };
}

describe('parseAllowedDatabases', () => {
  it('returns null for null/undefined/non-array values', () => {
    expect(parseAllowedDatabases(null)).toBeNull();
    expect(parseAllowedDatabases(undefined)).toBeNull();
    expect(parseAllowedDatabases('analytics')).toBeNull();
    expect(parseAllowedDatabases({})).toBeNull();
  });

  it('returns null for an empty or invalid list', () => {
    expect(parseAllowedDatabases([])).toBeNull();
    expect(parseAllowedDatabases([42, null, ''])).toBeNull();
  });

  it('trims and keeps valid database names', () => {
    expect(parseAllowedDatabases([' analytics ', 'logs'])).toEqual([
      'analytics',
      'logs',
    ]);
  });
});

describe('parseRoleQueryModes', () => {
  it('returns null for null/undefined/non-object values', () => {
    expect(parseRoleQueryModes(null)).toBeNull();
    expect(parseRoleQueryModes(undefined)).toBeNull();
    expect(parseRoleQueryModes('full')).toBeNull();
    expect(parseRoleQueryModes([])).toBeNull();
  });

  it('keeps only valid modes and ignores garbage', () => {
    expect(
      parseRoleQueryModes({
        MEMBER: 'readonly',
        VIEWER: 'blocked',
        ADMIN: 'nonsense',
        OWNER: 42,
      }),
    ).toEqual({ MEMBER: 'readonly', VIEWER: 'blocked' });
  });
});

describe('assertTeamConnectionAccess', () => {
  it('always grants the connection owner', () => {
    expect(() =>
      assertTeamConnectionAccess(
        makeConnection({ roleQueryModes: { MEMBER: 'blocked' } }),
        { userId: OWNER_ID, role: OrganizationRole.MEMBER },
        { database: 'anything', sql: 'DROP TABLE x', isReadOnlySql: false },
      ),
    ).not.toThrow();
  });

  it('ignores restrictions for personal connections (no org)', () => {
    expect(() =>
      assertTeamConnectionAccess(
        makeConnection({ organizationId: null }),
        { userId: MEMBER_ID, role: null },
        { database: 'any', sql: 'DELETE FROM x', isReadOnlySql: false },
      ),
    ).not.toThrow();
  });

  it('blocks a database outside the whitelist', () => {
    expect(() =>
      assertTeamConnectionAccess(
        makeConnection({ allowedDatabases: ['analytics'] }),
        { userId: MEMBER_ID, role: OrganizationRole.MEMBER },
        { database: 'secret_db', sql: 'SELECT 1', isReadOnlySql: true },
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows a whitelisted database', () => {
    expect(() =>
      assertTeamConnectionAccess(
        makeConnection({ allowedDatabases: ['analytics'] }),
        { userId: MEMBER_ID, role: OrganizationRole.MEMBER },
        { database: 'analytics', sql: 'SELECT 1', isReadOnlySql: true },
      ),
    ).not.toThrow();
  });

  it('blocks members whose role query mode is blocked', () => {
    expect(() =>
      assertTeamConnectionAccess(
        makeConnection({ roleQueryModes: { MEMBER: 'blocked' } }),
        { userId: MEMBER_ID, role: OrganizationRole.MEMBER },
        { database: 'analytics', sql: 'SELECT 1', isReadOnlySql: true },
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows read-only SQL for members in readonly mode', () => {
    expect(() =>
      assertTeamConnectionAccess(
        makeConnection({ roleQueryModes: { MEMBER: 'readonly' } }),
        { userId: MEMBER_ID, role: OrganizationRole.MEMBER },
        { database: 'analytics', sql: 'SELECT 1', isReadOnlySql: true },
      ),
    ).not.toThrow();
  });

  it('blocks mutating SQL for members in readonly mode', () => {
    expect(() =>
      assertTeamConnectionAccess(
        makeConnection({ roleQueryModes: { MEMBER: 'readonly' } }),
        { userId: MEMBER_ID, role: OrganizationRole.MEMBER },
        { database: 'analytics', sql: 'DELETE FROM x', isReadOnlySql: false },
      ),
    ).toThrow(ForbiddenException);
  });

  it('lets admins run anything when their mode is full', () => {
    expect(() =>
      assertTeamConnectionAccess(
        makeConnection({ roleQueryModes: { ADMIN: 'full' } }),
        { userId: MEMBER_ID, role: OrganizationRole.ADMIN },
        { database: 'analytics', sql: 'DELETE FROM x', isReadOnlySql: false },
      ),
    ).not.toThrow();
  });

  it('defaults unmapped roles to full access', () => {
    expect(() =>
      assertTeamConnectionAccess(
        makeConnection({ roleQueryModes: { MEMBER: 'readonly' } }),
        { userId: MEMBER_ID, role: OrganizationRole.VIEWER },
        { database: 'analytics', sql: 'DELETE FROM x', isReadOnlySql: false },
      ),
    ).not.toThrow();
  });
});
