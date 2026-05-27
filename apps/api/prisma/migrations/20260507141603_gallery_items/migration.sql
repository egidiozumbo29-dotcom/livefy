-- CreateEnum
CREATE TYPE "GalleryKind" AS ENUM ('PHOTO', 'VIDEO');

-- CreateTable
CREATE TABLE "GalleryItem" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "kind" "GalleryKind" NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "mediaUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "tokenPrice" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GalleryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GalleryPurchase" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "pricePaid" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GalleryPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GalleryItem_creatorId_published_idx" ON "GalleryItem"("creatorId", "published");

-- CreateIndex
CREATE INDEX "GalleryPurchase_buyerId_idx" ON "GalleryPurchase"("buyerId");

-- CreateIndex
CREATE UNIQUE INDEX "GalleryPurchase_itemId_buyerId_key" ON "GalleryPurchase"("itemId", "buyerId");

-- AddForeignKey
ALTER TABLE "GalleryItem" ADD CONSTRAINT "GalleryItem_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryPurchase" ADD CONSTRAINT "GalleryPurchase_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "GalleryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryPurchase" ADD CONSTRAINT "GalleryPurchase_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
