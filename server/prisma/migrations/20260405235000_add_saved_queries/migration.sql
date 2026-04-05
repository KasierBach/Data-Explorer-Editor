-- CreateTable
CREATE TABLE "SavedQuery" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sql" TEXT NOT NULL,
    "database" TEXT,
    "connectionId" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "folderId" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "SavedQuery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedQuery_userId_updatedAt_idx" ON "SavedQuery"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "SavedQuery_visibility_updatedAt_idx" ON "SavedQuery"("visibility", "updatedAt");

-- AddForeignKey
ALTER TABLE "SavedQuery" ADD CONSTRAINT "SavedQuery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
