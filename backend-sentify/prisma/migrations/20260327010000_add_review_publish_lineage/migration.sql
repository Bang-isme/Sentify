-- CreateTable
CREATE TABLE "ReviewPublishEvent" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "intakeItemId" TEXT NOT NULL,
    "crawlSourceId" TEXT,
    "crawlRunId" TEXT,
    "rawReviewId" TEXT,
    "rawReviewExternalKey" TEXT,
    "publishedByUserId" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewPublishEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewPublishEvent_intakeItemId_key" ON "ReviewPublishEvent"("intakeItemId");

-- CreateIndex
CREATE INDEX "ReviewPublishEvent_reviewId_publishedAt_idx" ON "ReviewPublishEvent"("reviewId", "publishedAt");

-- CreateIndex
CREATE INDEX "ReviewPublishEvent_restaurantId_publishedAt_idx" ON "ReviewPublishEvent"("restaurantId", "publishedAt");

-- CreateIndex
CREATE INDEX "ReviewPublishEvent_batchId_publishedAt_idx" ON "ReviewPublishEvent"("batchId", "publishedAt");

-- CreateIndex
CREATE INDEX "ReviewPublishEvent_crawlSourceId_publishedAt_idx" ON "ReviewPublishEvent"("crawlSourceId", "publishedAt");

-- CreateIndex
CREATE INDEX "ReviewPublishEvent_crawlRunId_publishedAt_idx" ON "ReviewPublishEvent"("crawlRunId", "publishedAt");

-- CreateIndex
CREATE INDEX "ReviewPublishEvent_rawReviewId_idx" ON "ReviewPublishEvent"("rawReviewId");

-- CreateIndex
CREATE INDEX "ReviewPublishEvent_publishedByUserId_publishedAt_idx" ON "ReviewPublishEvent"("publishedByUserId", "publishedAt");

-- AddForeignKey
ALTER TABLE "ReviewPublishEvent" ADD CONSTRAINT "ReviewPublishEvent_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewPublishEvent" ADD CONSTRAINT "ReviewPublishEvent_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewPublishEvent" ADD CONSTRAINT "ReviewPublishEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ReviewIntakeBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewPublishEvent" ADD CONSTRAINT "ReviewPublishEvent_intakeItemId_fkey" FOREIGN KEY ("intakeItemId") REFERENCES "ReviewIntakeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewPublishEvent" ADD CONSTRAINT "ReviewPublishEvent_crawlSourceId_fkey" FOREIGN KEY ("crawlSourceId") REFERENCES "ReviewCrawlSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewPublishEvent" ADD CONSTRAINT "ReviewPublishEvent_crawlRunId_fkey" FOREIGN KEY ("crawlRunId") REFERENCES "ReviewCrawlRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewPublishEvent" ADD CONSTRAINT "ReviewPublishEvent_rawReviewId_fkey" FOREIGN KEY ("rawReviewId") REFERENCES "ReviewCrawlRawReview"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewPublishEvent" ADD CONSTRAINT "ReviewPublishEvent_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
