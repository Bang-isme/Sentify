-- CreateEnum
CREATE TYPE "RestaurantSourceSubmissionStatus" AS ENUM ('PENDING_ADMIN_SYNC', 'LINKED_TO_SOURCE');

-- CreateTable
CREATE TABLE "RestaurantSourceSubmission" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "submittedByUserId" TEXT,
    "linkedSourceId" TEXT,
    "provider" "ReviewCrawlProvider" NOT NULL DEFAULT 'GOOGLE_MAPS',
    "inputUrl" TEXT NOT NULL,
    "normalizedUrl" TEXT,
    "canonicalCid" TEXT,
    "placeHexId" TEXT,
    "googlePlaceId" TEXT,
    "placeName" TEXT,
    "status" "RestaurantSourceSubmissionStatus" NOT NULL DEFAULT 'PENDING_ADMIN_SYNC',
    "recommendationCode" TEXT,
    "recommendationMessage" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastResolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantSourceSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantSourceSubmission_restaurantId_key" ON "RestaurantSourceSubmission"("restaurantId");

-- CreateIndex
CREATE INDEX "RestaurantSourceSubmission_status_updatedAt_idx" ON "RestaurantSourceSubmission"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "RestaurantSourceSubmission_provider_canonicalCid_idx" ON "RestaurantSourceSubmission"("provider", "canonicalCid");

-- CreateIndex
CREATE INDEX "RestaurantSourceSubmission_linkedSourceId_idx" ON "RestaurantSourceSubmission"("linkedSourceId");

-- AddForeignKey
ALTER TABLE "RestaurantSourceSubmission" ADD CONSTRAINT "RestaurantSourceSubmission_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantSourceSubmission" ADD CONSTRAINT "RestaurantSourceSubmission_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantSourceSubmission" ADD CONSTRAINT "RestaurantSourceSubmission_linkedSourceId_fkey" FOREIGN KEY ("linkedSourceId") REFERENCES "ReviewCrawlSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
