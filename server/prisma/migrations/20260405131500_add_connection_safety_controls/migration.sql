-- AlterTable
ALTER TABLE "Connection"
ADD COLUMN "readOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "allowSchemaChanges" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "allowImportExport" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "allowQueryExecution" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "lastHealthCheckAt" TIMESTAMP(3),
ADD COLUMN "lastHealthStatus" TEXT,
ADD COLUMN "lastHealthError" TEXT,
ADD COLUMN "lastConnectedAt" TIMESTAMP(3),
ADD COLUMN "lastConnectionLatencyMs" INTEGER;
