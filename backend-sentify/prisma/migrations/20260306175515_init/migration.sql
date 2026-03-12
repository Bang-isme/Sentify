-- CreateEnum
CREATE TYPE "RestaurantPermission" AS ENUM ('OWNER', 'MANAGER');

-- CreateEnum
CREATE TYPE "ReviewSentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Restaurant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "address" TEXT,
    "googleMapUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantUser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "permission" "RestaurantPermission" NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RestaurantUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "authorName" TEXT,
    "rating" INTEGER NOT NULL,
    "content" TEXT,
    "sentiment" "ReviewSentiment",
    "reviewDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsightSummary" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "positivePercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "neutralPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "negativePercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastCalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsightSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplaintKeyword" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplaintKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_slug_key" ON "Restaurant"("slug");

-- CreateIndex
CREATE INDEX "RestaurantUser_restaurantId_idx" ON "RestaurantUser"("restaurantId");

-- CreateIndex
CREATE INDEX "RestaurantUser_userId_idx" ON "RestaurantUser"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantUser_userId_restaurantId_key" ON "RestaurantUser"("userId", "restaurantId");

-- CreateIndex
CREATE INDEX "Review_restaurantId_rating_idx" ON "Review"("restaurantId", "rating");

-- CreateIndex
CREATE INDEX "Review_restaurantId_reviewDate_idx" ON "Review"("restaurantId", "reviewDate");

-- CreateIndex
CREATE INDEX "Review_restaurantId_sentiment_idx" ON "Review"("restaurantId", "sentiment");

-- CreateIndex
CREATE UNIQUE INDEX "Review_restaurantId_externalId_key" ON "Review"("restaurantId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "InsightSummary_restaurantId_key" ON "InsightSummary"("restaurantId");

-- CreateIndex
CREATE INDEX "ComplaintKeyword_restaurantId_count_idx" ON "ComplaintKeyword"("restaurantId", "count");

-- CreateIndex
CREATE UNIQUE INDEX "ComplaintKeyword_restaurantId_keyword_key" ON "ComplaintKeyword"("restaurantId", "keyword");

-- AddForeignKey
ALTER TABLE "RestaurantUser" ADD CONSTRAINT "RestaurantUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantUser" ADD CONSTRAINT "RestaurantUser_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsightSummary" ADD CONSTRAINT "InsightSummary_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintKeyword" ADD CONSTRAINT "ComplaintKeyword_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
