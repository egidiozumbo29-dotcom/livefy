-- CreateEnum
CREATE TYPE "ShowMode" AS ENUM ('PUBLIC', 'BASE', 'PRIVATE');

-- AlterTable
ALTER TABLE "Stream" ADD COLUMN     "basePrice" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "chatOpen" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "currentPrivateViewerId" TEXT,
ADD COLUMN     "privatePricePerMinute" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "showMode" "ShowMode" NOT NULL DEFAULT 'PUBLIC';

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "StreamAccess" (
    "id" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "mode" "ShowMode" NOT NULL,
    "pricePaid" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "StreamAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StreamAccess_streamId_viewerId_idx" ON "StreamAccess"("streamId", "viewerId");

-- CreateIndex
CREATE INDEX "StreamAccess_viewerId_idx" ON "StreamAccess"("viewerId");

-- AddForeignKey
ALTER TABLE "StreamAccess" ADD CONSTRAINT "StreamAccess_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE CASCADE ON UPDATE CASCADE;
