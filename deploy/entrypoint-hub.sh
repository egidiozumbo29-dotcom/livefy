#!/bin/sh
set -e
cd /app/apps/owner-hub
npx prisma db push --schema=prisma/schema.prisma --skip-generate
exec node server.js
