-- Profile: multiple languages label, outbound social URLs, coarse online presence.
ALTER TABLE "User" ADD COLUMN "languages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN "socialLinks" JSONB;
ALTER TABLE "User" ADD COLUMN "lastSeenAt" TIMESTAMP(3);
