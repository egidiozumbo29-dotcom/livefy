# Esegui dalla root del repo Livefy (PowerShell).
# Richiede Docker Desktop avviato.

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "Avvio PostgreSQL (Docker)..."
docker compose up -d
if ($LASTEXITCODE -ne 0) {
  Write-Host "Docker non disponibile: avvia Docker Desktop e riprova." -ForegroundColor Red
  exit 1
}

Write-Host "Attesa healthcheck Postgres..."
Start-Sleep -Seconds 8

Set-Location apps\api
Write-Host "Prisma migrate deploy + seed..."
npx prisma migrate deploy
npm run db:seed

Write-Host "`nFatto. Dalla root: npm run dev (API + web)" -ForegroundColor Green
