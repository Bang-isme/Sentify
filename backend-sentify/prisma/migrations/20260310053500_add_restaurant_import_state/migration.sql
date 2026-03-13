CREATE TYPE "RestaurantImportCompleteness" AS ENUM ('UNKNOWN', 'PARTIAL', 'COMPLETE');

ALTER TABLE "Restaurant"
ADD COLUMN "latestSuccessfulImportedAt" TIMESTAMP(3),
ADD COLUMN "lastCompleteSyncAt" TIMESTAMP(3),
ADD COLUMN "completenessState" "RestaurantImportCompleteness" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "coverageEstimate" DOUBLE PRECISION,
ADD COLUMN "checkpointCursor" JSONB,
ADD COLUMN "checkpointReviewCount" INTEGER;

UPDATE "Restaurant" AS r
SET
  "latestSuccessfulImportedAt" = (
    SELECT COALESCE(ir."completedAt", ir."createdAt")
    FROM "ImportRun" AS ir
    WHERE
      ir."restaurantId" = r."id"
      AND ir."status" = 'COMPLETED'
    ORDER BY COALESCE(ir."completedAt", ir."createdAt") DESC
    LIMIT 1
  ),
  "lastCompleteSyncAt" = (
    SELECT COALESCE(ir."completedAt", ir."createdAt")
    FROM "ImportRun" AS ir
    WHERE
      ir."restaurantId" = r."id"
      AND ir."status" = 'COMPLETED'
      AND ir."isCompleteSync" = true
    ORDER BY COALESCE(ir."completedAt", ir."createdAt") DESC
    LIMIT 1
  ),
  "completenessState" = CASE
    WHEN EXISTS (
      SELECT 1
      FROM "ImportRun" AS ir
      WHERE
        ir."restaurantId" = r."id"
        AND ir."status" = 'COMPLETED'
        AND ir."isCompleteSync" = true
    ) THEN 'COMPLETE'::"RestaurantImportCompleteness"
    WHEN EXISTS (
      SELECT 1
      FROM "ImportRun" AS ir
      WHERE
        ir."restaurantId" = r."id"
        AND ir."status" = 'COMPLETED'
    ) THEN 'PARTIAL'::"RestaurantImportCompleteness"
    ELSE 'UNKNOWN'::"RestaurantImportCompleteness"
  END,
  "coverageEstimate" = (
    SELECT ir."coveragePercentage"
    FROM "ImportRun" AS ir
    WHERE
      ir."restaurantId" = r."id"
      AND ir."status" = 'COMPLETED'
    ORDER BY COALESCE(ir."completedAt", ir."createdAt") DESC
    LIMIT 1
  ),
  "checkpointReviewCount" = (
    SELECT ir."collectedReviewCount"
    FROM "ImportRun" AS ir
    WHERE
      ir."restaurantId" = r."id"
      AND ir."status" = 'COMPLETED'
    ORDER BY COALESCE(ir."completedAt", ir."createdAt") DESC
    LIMIT 1
  );
