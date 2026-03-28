CREATE TYPE "RestaurantSourceSubmissionStatus_new" AS ENUM (
    'PENDING_IDENTITY_RESOLUTION',
    'READY_FOR_SOURCE_LINK',
    'LINKED_TO_SOURCE'
);

ALTER TABLE "RestaurantSourceSubmission"
ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "RestaurantSourceSubmission"
ALTER COLUMN "status" TYPE "RestaurantSourceSubmissionStatus_new"
USING (
    CASE
        WHEN "linkedSourceId" IS NOT NULL OR "status"::text = 'LINKED_TO_SOURCE'
            THEN 'LINKED_TO_SOURCE'
        WHEN "canonicalCid" IS NOT NULL
            THEN 'READY_FOR_SOURCE_LINK'
        ELSE 'PENDING_IDENTITY_RESOLUTION'
    END
)::"RestaurantSourceSubmissionStatus_new";

ALTER TABLE "RestaurantSourceSubmission"
ALTER COLUMN "status" SET DEFAULT 'PENDING_IDENTITY_RESOLUTION';

DROP TYPE "RestaurantSourceSubmissionStatus";

ALTER TYPE "RestaurantSourceSubmissionStatus_new"
RENAME TO "RestaurantSourceSubmissionStatus";
