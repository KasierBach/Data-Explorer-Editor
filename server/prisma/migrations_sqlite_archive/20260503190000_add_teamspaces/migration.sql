-- CreateTable
CREATE TABLE "Teamspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,
    CONSTRAINT "Teamspace_pkey" PRIMARY KEY ("id")
);

-- AddColumn
ALTER TABLE "OrganizationResource" ADD COLUMN "teamspaceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Teamspace_organizationId_slug_key" ON "Teamspace"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "Teamspace_organizationId_idx" ON "Teamspace"("organizationId");

-- CreateIndex
CREATE INDEX "Teamspace_createdBy_idx" ON "Teamspace"("createdBy");

-- CreateIndex
CREATE INDEX "OrganizationResource_teamspaceId_idx" ON "OrganizationResource"("teamspaceId");

-- AddForeignKey
ALTER TABLE "Teamspace" ADD CONSTRAINT "Teamspace_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teamspace" ADD CONSTRAINT "Teamspace_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationResource" ADD CONSTRAINT "OrganizationResource_teamspaceId_fkey" FOREIGN KEY ("teamspaceId") REFERENCES "Teamspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
