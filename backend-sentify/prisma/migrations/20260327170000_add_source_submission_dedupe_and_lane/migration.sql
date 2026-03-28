CREATE TYPE "RestaurantSourceSubmissionSchedulingLane" AS ENUM (
    'STANDARD',
    'PRIORITY'
);

ALTER TABLE "RestaurantSourceSubmission"
ADD COLUMN "dedupeKey" TEXT;

ALTER TABLE "RestaurantSourceSubmission"
ADD COLUMN "schedulingLane" "RestaurantSourceSubmissionSchedulingLane" NOT NULL DEFAULT 'STANDARD';

UPDATE "RestaurantSourceSubmission"
SET "dedupeKey" = CASE
    WHEN "canonicalCid" IS NOT NULL THEN 'cid:' || "canonicalCid"
    WHEN "normalizedUrl" IS NOT NULL THEN 'url:' || "normalizedUrl"
    ELSE 'url:' || "inputUrl"
END;

ALTER TABLE "RestaurantSourceSubmission"
ALTER COLUMN "dedupeKey" SET NOT NULL;

CREATE INDEX "RestaurantSourceSubmission_schedulingLane_status_updatedAt_idx"
ON "RestaurantSourceSubmission"("schedulingLane", "status", "updatedAt");

CREATE INDEX "RestaurantSourceSubmission_provider_dedupeKey_idx"
ON "RestaurantSourceSubmission"("provider", "dedupeKey");
