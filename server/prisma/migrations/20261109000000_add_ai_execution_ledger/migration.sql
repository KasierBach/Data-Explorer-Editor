-- Additive metadata ledger. No retention policy, cleanup, or tariff is implied.
CREATE TABLE "AiGeneration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'running',
    "connectionId" TEXT,
    "database" TEXT,
    "requestedModel" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "measuredAttemptCount" INTEGER NOT NULL DEFAULT 0,
    "promptTokens" BIGINT,
    "completionTokens" BIGINT,
    "totalTokens" BIGINT,
    "usageCoverage" TEXT NOT NULL DEFAULT 'unavailable',
    "latencyMs" INTEGER,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiGeneration_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AiGeneration_attempt_counts_check" CHECK (
        "attemptCount" BETWEEN 0 AND 8 AND "measuredAttemptCount" BETWEEN 0 AND "attemptCount"
    ),
    CONSTRAINT "AiGeneration_outcome_check" CHECK (
        "outcome" IN ('running', 'succeeded', 'failed', 'cancelled', 'timed_out', 'rejected')
    ),
    CONSTRAINT "AiGeneration_usage_check" CHECK (
        "usageCoverage" IN ('complete', 'partial', 'unavailable') AND
        ("promptTokens" IS NULL OR "promptTokens" >= 0) AND
        ("completionTokens" IS NULL OR "completionTokens" >= 0) AND
        ("totalTokens" IS NULL OR "totalTokens" >= 0)
    )
);

CREATE TABLE "AiProviderAttempt" (
    "id" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "plannedProvider" TEXT NOT NULL,
    "plannedModel" TEXT NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "outcome" TEXT NOT NULL DEFAULT 'running',
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "usageCoverage" TEXT NOT NULL DEFAULT 'unavailable',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiProviderAttempt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AiProviderAttempt_ordinal_check" CHECK ("ordinal" BETWEEN 1 AND 8),
    CONSTRAINT "AiProviderAttempt_outcome_check" CHECK (
        "outcome" IN ('running', 'succeeded', 'failed', 'cancelled', 'timed_out')
    ),
    CONSTRAINT "AiProviderAttempt_usage_check" CHECK (
        "usageCoverage" IN ('complete', 'partial', 'unavailable') AND
        ("promptTokens" IS NULL OR "promptTokens" >= 0) AND
        ("completionTokens" IS NULL OR "completionTokens" >= 0) AND
        ("totalTokens" IS NULL OR "totalTokens" >= 0)
    )
);

CREATE TABLE "AiGenerationFeedback" (
    "id" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiGenerationFeedback_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AiGenerationFeedback_rating_check" CHECK ("rating" IN ('up', 'down'))
);

CREATE UNIQUE INDEX "AiGeneration_id_userId_key" ON "AiGeneration"("id", "userId");
CREATE INDEX "AiGeneration_userId_createdAt_idx" ON "AiGeneration"("userId", "createdAt");
CREATE INDEX "AiGeneration_outcome_createdAt_idx" ON "AiGeneration"("outcome", "createdAt");
CREATE UNIQUE INDEX "AiProviderAttempt_generationId_ordinal_key" ON "AiProviderAttempt"("generationId", "ordinal");
CREATE INDEX "AiProviderAttempt_generationId_outcome_idx" ON "AiProviderAttempt"("generationId", "outcome");
CREATE UNIQUE INDEX "AiGenerationFeedback_generationId_userId_key" ON "AiGenerationFeedback"("generationId", "userId");
CREATE INDEX "AiGenerationFeedback_userId_updatedAt_idx" ON "AiGenerationFeedback"("userId", "updatedAt");

ALTER TABLE "AiGeneration" ADD CONSTRAINT "AiGeneration_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiProviderAttempt" ADD CONSTRAINT "AiProviderAttempt_generationId_fkey"
    FOREIGN KEY ("generationId") REFERENCES "AiGeneration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiGenerationFeedback" ADD CONSTRAINT "AiGenerationFeedback_generationId_userId_fkey"
    FOREIGN KEY ("generationId", "userId") REFERENCES "AiGeneration"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiGenerationFeedback" ADD CONSTRAINT "AiGenerationFeedback_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
