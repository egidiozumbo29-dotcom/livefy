-- CreateTable
CREATE TABLE "streamer_verifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "idDocumentPath" TEXT NOT NULL,
    "selfieWithIdPath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "streamer_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "streamer_verifications_userId_key" ON "streamer_verifications"("userId");

-- AddForeignKey
ALTER TABLE "streamer_verifications" ADD CONSTRAINT "streamer_verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
