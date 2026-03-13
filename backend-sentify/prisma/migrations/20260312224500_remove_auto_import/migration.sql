ALTER TABLE "Restaurant"
DROP COLUMN "latestSuccessfulImportedAt",
DROP COLUMN "lastCompleteSyncAt",
DROP COLUMN "completenessState",
DROP COLUMN "coverageEstimate",
DROP COLUMN "checkpointCursor",
DROP COLUMN "checkpointReviewCount";

DROP TABLE "ImportRun";

DROP TYPE "ImportRunStatus";
DROP TYPE "RestaurantImportCompleteness";
