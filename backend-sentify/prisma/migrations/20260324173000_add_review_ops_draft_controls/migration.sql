ALTER TABLE "ReviewIntakeBatch"
    ADD COLUMN "crawlSourceId" TEXT;

CREATE INDEX "ReviewIntakeBatch_crawlSourceId_idx"
ON "ReviewIntakeBatch"("crawlSourceId");

ALTER TABLE "ReviewIntakeBatch"
    ADD CONSTRAINT "ReviewIntakeBatch_crawlSourceId_fkey"
    FOREIGN KEY ("crawlSourceId") REFERENCES "ReviewCrawlSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ReviewCrawlRun_sourceId_active_unique"
ON "ReviewCrawlRun"("sourceId")
WHERE "status" IN ('QUEUED', 'RUNNING');

CREATE UNIQUE INDEX "ReviewIntakeBatch_crawlSourceId_open_unique"
ON "ReviewIntakeBatch"("crawlSourceId")
WHERE "crawlSourceId" IS NOT NULL
  AND "status" IN ('DRAFT', 'IN_REVIEW', 'READY_TO_PUBLISH');
