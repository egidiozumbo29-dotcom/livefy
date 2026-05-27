-- Esegui DOPO la migrazione Prisma (migrate deploy o SQL init).
-- Streamer demo: streamer@demo.synthra / StreamerDemo123!

INSERT INTO "User" (
  "id",
  "username",
  "email",
  "passwordHash",
  "role",
  "balance",
  "birthDate",
  "ageVerified",
  "country",
  "language",
  "category",
  "tags",
  "bio",
  "banned",
  "createdAt",
  "updatedAt"
)
VALUES (
  'synthra_seed_demo_streamer',
  'demo_streamer',
  'streamer@demo.synthra',
  '$2a$12$Z7z5ediGm3Hv.HqvOB52hOiNZdhIHHfTbwfvvy5AwSJaBOXdfGtGe',
  'MODEL',
  0,
  '1990-05-15 00:00:00'::timestamp,
  true,
  'IT',
  'it',
  'Demo',
  ARRAY['demo', 'live']::TEXT[],
  'Seed demo',
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("email") DO NOTHING;
