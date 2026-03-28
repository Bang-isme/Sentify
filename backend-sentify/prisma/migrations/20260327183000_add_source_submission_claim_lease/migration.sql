ALTER TABLE "RestaurantSourceSubmission"
ADD COLUMN "claimedByUserId" TEXT,
ADD COLUMN "claimedAt" TIMESTAMP(3),
ADD COLUMN "claimExpiresAt" TIMESTAMP(3);

CREATE INDEX "RestaurantSourceSubmission_schedulingLane_status_claimExpiresAt_submittedAt_idx"
ON "RestaurantSourceSubmission"("schedulingLane", "status", "claimExpiresAt", "submittedAt");
