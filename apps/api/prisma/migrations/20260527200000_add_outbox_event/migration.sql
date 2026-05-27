-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_externalId_key" ON "OutboxEvent"("externalId");

-- CreateIndex
CREATE INDEX "OutboxEvent_sentAt_attempts_idx" ON "OutboxEvent"("sentAt", "attempts");

-- CreateIndex
CREATE INDEX "OutboxEvent_occurredAt_idx" ON "OutboxEvent"("occurredAt");
