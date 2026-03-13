BEGIN;

UPDATE "ReviewIntakeBatch"
SET "sourceType" = 'MANUAL'
WHERE "sourceType" = 'GOOGLE_ASSISTED';

CREATE TYPE "ReviewIntakeBatchSourceType_new" AS ENUM ('MANUAL', 'BULK_PASTE', 'CSV');

ALTER TABLE "ReviewIntakeBatch"
ALTER COLUMN "sourceType" TYPE "ReviewIntakeBatchSourceType_new"
USING ("sourceType"::text::"ReviewIntakeBatchSourceType_new");

DROP TYPE "ReviewIntakeBatchSourceType";

ALTER TYPE "ReviewIntakeBatchSourceType_new" RENAME TO "ReviewIntakeBatchSourceType";

COMMIT;
