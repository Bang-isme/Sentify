ALTER TABLE "User"
ADD COLUMN "manuallyLockedAt" TIMESTAMP(3),
ADD COLUMN "deactivatedAt" TIMESTAMP(3);

CREATE TABLE "PlatformControl" (
    "id" TEXT NOT NULL DEFAULT 'platform',
    "crawlQueueWritesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "crawlMaterializationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "intakePublishEnabled" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformControl_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PlatformControl" (
    "id",
    "crawlQueueWritesEnabled",
    "crawlMaterializationEnabled",
    "intakePublishEnabled"
)
VALUES (
    'platform',
    true,
    true,
    true
)
ON CONFLICT ("id") DO NOTHING;
