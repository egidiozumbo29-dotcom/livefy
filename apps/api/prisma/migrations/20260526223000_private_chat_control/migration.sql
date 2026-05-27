CREATE TABLE "PrivateChatControl" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivateChatControl_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrivateChatControl_creatorId_viewerId_key" ON "PrivateChatControl"("creatorId", "viewerId");
CREATE INDEX "PrivateChatControl_viewerId_idx" ON "PrivateChatControl"("viewerId");

ALTER TABLE "PrivateChatControl" ADD CONSTRAINT "PrivateChatControl_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrivateChatControl" ADD CONSTRAINT "PrivateChatControl_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
