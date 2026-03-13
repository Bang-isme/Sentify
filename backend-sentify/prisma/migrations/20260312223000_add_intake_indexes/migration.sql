CREATE INDEX "ReviewIntakeBatch_restaurantId_updatedAt_createdAt_idx"
ON "ReviewIntakeBatch"("restaurantId", "updatedAt", "createdAt");

CREATE INDEX "ReviewIntakeItem_batchId_createdAt_idx"
ON "ReviewIntakeItem"("batchId", "createdAt");
