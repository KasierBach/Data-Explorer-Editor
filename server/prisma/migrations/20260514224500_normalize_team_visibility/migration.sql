UPDATE "SavedQuery"
SET "visibility" = 'workspace'
WHERE "visibility" = 'team'
  AND "organizationId" IS NOT NULL;

UPDATE "SavedQuery"
SET "visibility" = 'private'
WHERE "visibility" = 'team'
  AND "organizationId" IS NULL;

UPDATE "Dashboard"
SET "visibility" = 'workspace'
WHERE "visibility" = 'team'
  AND "organizationId" IS NOT NULL;

UPDATE "Dashboard"
SET "visibility" = 'private'
WHERE "visibility" = 'team'
  AND "organizationId" IS NULL;

DELETE FROM "OrganizationResource" resource
USING "SavedQuery" query
WHERE resource."resourceType" = 'QUERY'
  AND resource."resourceId" = query."id"
  AND (query."visibility" = 'private' OR query."organizationId" IS NULL);

DELETE FROM "OrganizationResource" resource
USING "Dashboard" dashboard
WHERE resource."resourceType" = 'DASHBOARD'
  AND resource."resourceId" = dashboard."id"
  AND (dashboard."visibility" = 'private' OR dashboard."organizationId" IS NULL);

UPDATE "SavedQuery"
SET "organizationId" = NULL
WHERE "visibility" = 'private';

UPDATE "Dashboard"
SET "organizationId" = NULL
WHERE "visibility" = 'private';
