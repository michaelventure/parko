-- CreateTable
CREATE TABLE "Capacity" (
    "id" TEXT NOT NULL,
    "totalSpaces" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "lastOverflowAt" TIMESTAMP(3),
    "lastOverflowAmount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Capacity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Capacity_isActive_idx" ON "Capacity"("isActive");
