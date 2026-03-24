DROP INDEX "ReviewIntakeItem_canonicalReviewId_key";

CREATE INDEX "ReviewIntakeItem_canonicalReviewId_idx" ON "ReviewIntakeItem"("canonicalReviewId");
