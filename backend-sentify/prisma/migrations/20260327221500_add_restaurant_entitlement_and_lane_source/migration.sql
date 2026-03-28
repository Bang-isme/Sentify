-- CreateEnum
CREATE TYPE "RestaurantSourceSubmissionSchedulingLaneSource" AS ENUM ('ENTITLEMENT_DEFAULT', 'ADMIN_OVERRIDE');

-- CreateEnum
CREATE TYPE "RestaurantPlanTier" AS ENUM ('FREE', 'PREMIUM');

-- AlterTable
ALTER TABLE "RestaurantSourceSubmission"
ADD COLUMN "schedulingLaneSource" "RestaurantSourceSubmissionSchedulingLaneSource" NOT NULL DEFAULT 'ENTITLEMENT_DEFAULT';

-- CreateTable
CREATE TABLE "RestaurantEntitlement" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "planTier" "RestaurantPlanTier" NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantEntitlement_pkey" PRIMARY KEY ("id")
);

-- Backfill
INSERT INTO "RestaurantEntitlement" (
    "id",
    "restaurantId",
    "planTier",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "id",
    'FREE'::"RestaurantPlanTier",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Restaurant"
WHERE NOT EXISTS (
    SELECT 1
    FROM "RestaurantEntitlement"
    WHERE "RestaurantEntitlement"."restaurantId" = "Restaurant"."id"
);

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantEntitlement_restaurantId_key" ON "RestaurantEntitlement"("restaurantId");

-- CreateIndex
CREATE INDEX "RestaurantEntitlement_planTier_updatedAt_idx" ON "RestaurantEntitlement"("planTier", "updatedAt");

-- CreateIndex
CREATE INDEX "RestaurantSourceSubmission_schedulingLaneSource_status_updatedAt_idx"
ON "RestaurantSourceSubmission"("schedulingLaneSource", "status", "updatedAt");

-- AddForeignKey
ALTER TABLE "RestaurantEntitlement"
ADD CONSTRAINT "RestaurantEntitlement_restaurantId_fkey"
FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
