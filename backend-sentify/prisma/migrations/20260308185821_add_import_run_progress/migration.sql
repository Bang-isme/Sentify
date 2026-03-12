-- AlterTable
ALTER TABLE "ImportRun" ADD COLUMN     "phase" TEXT,
ADD COLUMN     "progressPercent" INTEGER NOT NULL DEFAULT 0;
