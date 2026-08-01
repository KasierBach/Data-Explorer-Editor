CREATE TABLE "AiProviderConnection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'openai-compatible',
    "baseUrl" TEXT NOT NULL,
    "apiKey" TEXT,
    "model" TEXT NOT NULL,
    "models" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "capabilities" JSONB NOT NULL DEFAULT '{}',
    "lastTestedAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastError" TEXT,
    "lastLatencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "AiProviderConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiProviderConnection_userId_name_key"
ON "AiProviderConnection"("userId", "name");

CREATE INDEX "AiProviderConnection_userId_updatedAt_idx"
ON "AiProviderConnection"("userId", "updatedAt");

ALTER TABLE "AiProviderConnection"
ADD CONSTRAINT "AiProviderConnection_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
