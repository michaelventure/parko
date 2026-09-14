-- CreateTable
CREATE TABLE "ChatUsage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "usageDate" TEXT NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ChatUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatUsage_tenantId_usageDate_key" ON "ChatUsage"("tenantId", "usageDate");

-- AddForeignKey
ALTER TABLE "ChatUsage" ADD CONSTRAINT "ChatUsage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
