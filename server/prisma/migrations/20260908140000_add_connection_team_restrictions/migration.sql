-- Add per-connection team access restrictions.
-- Both columns are nullable JSON: null keeps today's unrestricted behavior.

-- Whitelist of database names members may access (null = all databases).
ALTER TABLE "Connection" ADD COLUMN "allowedDatabases" JSONB;

-- Per-org-role query access: 'blocked' | 'readonly' | 'full' (null = full).
ALTER TABLE "Connection" ADD COLUMN "roleQueryModes" JSONB;
