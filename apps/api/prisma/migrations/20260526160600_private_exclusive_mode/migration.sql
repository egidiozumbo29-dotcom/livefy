CREATE TYPE "PrivateRequestKind" AS ENUM ('NORMAL', 'EXCLUSIVE');

ALTER TABLE "Stream"
ADD COLUMN "currentPrivateExclusive" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "PrivateRequest"
ADD COLUMN "kind" "PrivateRequestKind" NOT NULL DEFAULT 'NORMAL';
