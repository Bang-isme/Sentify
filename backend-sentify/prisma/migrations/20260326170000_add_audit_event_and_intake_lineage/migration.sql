-- Add durable audit storage plus intake review/publish lineage.
ALTER TABLE "ReviewIntakeBatch"
ADD COLUMN "publishedByUserId" TEXT;

ALTER TABLE "ReviewIntakeItem"
ADD COLUMN "lastReviewedAt" TIMESTAMP(3),
ADD COLUMN "lastReviewedByUserId" TEXT;

CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "restaurantId" TEXT,
    "actorUserId" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");
CREATE INDEX "AuditEvent_resourceType_resourceId_createdAt_idx" ON "AuditEvent"("resourceType", "resourceId", "createdAt");
CREATE INDEX "AuditEvent_restaurantId_createdAt_idx" ON "AuditEvent"("restaurantId", "createdAt");
CREATE INDEX "AuditEvent_actorUserId_createdAt_idx" ON "AuditEvent"("actorUserId", "createdAt");
CREATE INDEX "ReviewIntakeBatch_publishedByUserId_publishedAt_idx" ON "ReviewIntakeBatch"("publishedByUserId", "publishedAt");
CREATE INDEX "ReviewIntakeItem_lastReviewedByUserId_lastReviewedAt_idx" ON "ReviewIntakeItem"("lastReviewedByUserId", "lastReviewedAt");

ALTER TABLE "ReviewIntakeBatch"
ADD CONSTRAINT "ReviewIntakeBatch_publishedByUserId_fkey"
FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReviewIntakeItem"
ADD CONSTRAINT "ReviewIntakeItem_lastReviewedByUserId_fkey"
FOREIGN KEY ("lastReviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AuditEvent"
ADD CONSTRAINT "AuditEvent_restaurantId_fkey"
FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AuditEvent"
ADD CONSTRAINT "AuditEvent_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
