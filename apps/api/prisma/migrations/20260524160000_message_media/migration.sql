-- Allinea tabella Message al schema Prisma:
-- - aggiunge mediaUrl, mediaType
-- - rende content nullable con default ""
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "mediaUrl" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "mediaType" TEXT;
ALTER TABLE "Message" ALTER COLUMN "content" SET DEFAULT '';
