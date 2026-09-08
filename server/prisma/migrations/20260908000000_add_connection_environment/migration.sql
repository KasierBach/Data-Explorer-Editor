-- Baseline for the Connection.environment column that was applied to the
-- production database via `prisma db push` before migration history caught up.
ALTER TABLE "Connection" ADD COLUMN "environment" TEXT;
