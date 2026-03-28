ALTER TABLE "PlatformControl"
ADD COLUMN "sourceSubmissionAutoBootstrapEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "sourceSubmissionAutoBootstrapMaxPerTick" INTEGER NOT NULL DEFAULT 20;
