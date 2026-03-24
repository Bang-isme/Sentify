ALTER TYPE "ReviewIntakeBatchSourceType" ADD VALUE IF NOT EXISTS 'GOOGLE_MAPS_CRAWL';

CREATE TYPE "ReviewCrawlProvider" AS ENUM ('GOOGLE_MAPS');
CREATE TYPE "ReviewCrawlSourceStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "ReviewCrawlRunStrategy" AS ENUM ('INCREMENTAL', 'BACKFILL');
CREATE TYPE "ReviewCrawlRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'PARTIAL', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "ReviewCrawlRunPriority" AS ENUM ('HIGH', 'NORMAL', 'LOW');

ALTER TABLE "ReviewIntakeItem"
    ADD COLUMN "sourceProvider" "ReviewCrawlProvider",
    ADD COLUMN "sourceExternalId" TEXT,
    ADD COLUMN "sourceReviewUrl" TEXT;

CREATE TABLE "ReviewCrawlSource" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "provider" "ReviewCrawlProvider" NOT NULL DEFAULT 'GOOGLE_MAPS',
    "status" "ReviewCrawlSourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "inputUrl" TEXT NOT NULL,
    "resolvedUrl" TEXT,
    "canonicalCid" TEXT NOT NULL,
    "placeHexId" TEXT,
    "googlePlaceId" TEXT,
    "placeName" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "region" TEXT NOT NULL DEFAULT 'us',
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "syncIntervalMinutes" INTEGER NOT NULL DEFAULT 1440,
    "lastReportedTotal" INTEGER,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSuccessfulRunAt" TIMESTAMP(3),
    "nextScheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewCrawlSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReviewCrawlRun" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "requestedByUserId" TEXT,
    "intakeBatchId" TEXT,
    "strategy" "ReviewCrawlRunStrategy" NOT NULL DEFAULT 'INCREMENTAL',
    "status" "ReviewCrawlRunStatus" NOT NULL DEFAULT 'QUEUED',
    "priority" "ReviewCrawlRunPriority" NOT NULL DEFAULT 'NORMAL',
    "reportedTotal" INTEGER,
    "extractedCount" INTEGER NOT NULL DEFAULT 0,
    "validCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "pagesFetched" INTEGER NOT NULL DEFAULT 0,
    "pageSize" INTEGER NOT NULL DEFAULT 20,
    "delayMs" INTEGER NOT NULL DEFAULT 500,
    "maxPages" INTEGER,
    "maxReviews" INTEGER,
    "checkpointCursor" TEXT,
    "knownReviewStreak" INTEGER NOT NULL DEFAULT 0,
    "cancelRequestedAt" TIMESTAMP(3),
    "leaseToken" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "warningsJson" JSONB,
    "metadataJson" JSONB,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "lastCheckpointAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewCrawlRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReviewCrawlRawReview" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "firstSeenRunId" TEXT NOT NULL,
    "lastSeenRunId" TEXT NOT NULL,
    "externalReviewKey" TEXT NOT NULL,
    "providerReviewId" TEXT,
    "reviewUrl" TEXT,
    "authorName" TEXT,
    "rating" INTEGER,
    "content" TEXT,
    "reviewDate" TIMESTAMP(3),
    "language" TEXT,
    "ownerResponseText" TEXT,
    "validForIntake" BOOLEAN NOT NULL DEFAULT false,
    "validationIssues" JSONB,
    "intakeItemPayload" JSONB,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewCrawlRawReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReviewCrawlSource_restaurantId_provider_canonicalCid_key"
ON "ReviewCrawlSource"("restaurantId", "provider", "canonicalCid");

CREATE INDEX "ReviewCrawlSource_restaurantId_status_idx"
ON "ReviewCrawlSource"("restaurantId", "status");

CREATE INDEX "ReviewCrawlSource_status_nextScheduledAt_idx"
ON "ReviewCrawlSource"("status", "nextScheduledAt");

CREATE INDEX "ReviewCrawlSource_restaurantId_provider_status_idx"
ON "ReviewCrawlSource"("restaurantId", "provider", "status");

CREATE INDEX "ReviewCrawlRun_sourceId_status_queuedAt_idx"
ON "ReviewCrawlRun"("sourceId", "status", "queuedAt");

CREATE INDEX "ReviewCrawlRun_restaurantId_status_queuedAt_idx"
ON "ReviewCrawlRun"("restaurantId", "status", "queuedAt");

CREATE INDEX "ReviewCrawlRun_status_leaseExpiresAt_idx"
ON "ReviewCrawlRun"("status", "leaseExpiresAt");

CREATE INDEX "ReviewCrawlRun_intakeBatchId_idx"
ON "ReviewCrawlRun"("intakeBatchId");

CREATE UNIQUE INDEX "ReviewCrawlRawReview_sourceId_externalReviewKey_key"
ON "ReviewCrawlRawReview"("sourceId", "externalReviewKey");

CREATE INDEX "ReviewCrawlRawReview_lastSeenRunId_idx"
ON "ReviewCrawlRawReview"("lastSeenRunId");

CREATE INDEX "ReviewCrawlRawReview_sourceId_reviewDate_idx"
ON "ReviewCrawlRawReview"("sourceId", "reviewDate");

CREATE INDEX "ReviewCrawlRawReview_sourceId_updatedAt_idx"
ON "ReviewCrawlRawReview"("sourceId", "updatedAt");

CREATE INDEX "ReviewIntakeItem_sourceProvider_sourceExternalId_idx"
ON "ReviewIntakeItem"("sourceProvider", "sourceExternalId");

ALTER TABLE "ReviewCrawlSource"
    ADD CONSTRAINT "ReviewCrawlSource_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReviewCrawlRun"
    ADD CONSTRAINT "ReviewCrawlRun_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "ReviewCrawlSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReviewCrawlRun"
    ADD CONSTRAINT "ReviewCrawlRun_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReviewCrawlRun"
    ADD CONSTRAINT "ReviewCrawlRun_requestedByUserId_fkey"
    FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReviewCrawlRun"
    ADD CONSTRAINT "ReviewCrawlRun_intakeBatchId_fkey"
    FOREIGN KEY ("intakeBatchId") REFERENCES "ReviewIntakeBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReviewCrawlRawReview"
    ADD CONSTRAINT "ReviewCrawlRawReview_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "ReviewCrawlSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
