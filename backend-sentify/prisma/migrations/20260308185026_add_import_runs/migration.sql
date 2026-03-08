-- CreateEnum
CREATE TYPE "ImportRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "ImportRun" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "status" "ImportRunStatus" NOT NULL DEFAULT 'QUEUED',
    "imported" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "scrapeSource" TEXT,
    "advertisedTotalReviews" INTEGER,
    "collectedReviewCount" INTEGER,
    "targetReviewCount" INTEGER,
    "explicitTarget" INTEGER,
    "hardMaxReviews" INTEGER,
    "reachedRequestedTarget" BOOLEAN,
    "reachedEndOfFeed" BOOLEAN,
    "coveragePercentage" DOUBLE PRECISION,
    "isCompleteSync" BOOLEAN,
    "message" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "errorDetails" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportRun_restaurantId_status_createdAt_idx" ON "ImportRun"("restaurantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ImportRun_requestedByUserId_createdAt_idx" ON "ImportRun"("requestedByUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "ImportRun" ADD CONSTRAINT "ImportRun_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRun" ADD CONSTRAINT "ImportRun_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
