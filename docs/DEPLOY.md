# Synthra — pubblicazione in produzione

Monorepo: **NestJS** (`apps/api`) + **Next.js** (`apps/web`) + **Postgres** (Prisma). LiveKit e Stripe sono opzionali ma necessari per rispettive funzioni.

---

## Variabili d’ambiente

### API (`apps/api`)

| Variabile | Obbligatoria | Ruolo |
|-----------|---------------|-------|
| `DATABASE_URL` | sì | Connessione SQL (preferisci pooling in produzione se supportato dall’host). |
| `DIRECT_URL` | sì\* | Connessione “direct” per `prisma migrate` (Supabase / PgBouncer: URL senza transaction pool). |
| `JWT_SECRET` | sì | Firma degli access token. |
| `CORS_ORIGIN` | produzione | Origini HTTPS del sito, separate da virgola. |
| `SOCKET_CORS_ORIGIN` | produzione | Origini per Socket.IO (chat). |
| `PORT` | no | Default `4000`. |
| `PLATFORM_TIP_FEE_PERCENT` | no | Fee 0–90 su tip, accessi show e acquisti galleria (default logico nel codice). |
| `FRONTEND_URL` | con Stripe | Base URL del sito (redirect Checkout). |
| `LIVEKIT_URL` | per le live | WebSocket URL del server LiveKit. |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | per le live | Credenziali API LiveKit. |
| `REDIS_URL` | no | Se assente, la cache è disabilitata (warning in log). |
| `STRIPE_SECRET_KEY` | per pagamenti | Segreto Stripe. |
| `STRIPE_WEBHOOK_SECRET` | per pagamenti | Verifica firma webhook. |
| `MIN_PAYOUT_TOKENS` | no | Soglia minima richieste payout. |

\*Se non usi pooler, `DIRECT_URL` può coincidere con `DATABASE_URL`.

### Web (`apps/web`)

| Variabile | Ruolo |
|-----------|--------|
| `NEXT_PUBLIC_API_URL` | Base REST **con** suffisso `/api` (es. `https://api.example.com/api`). |
| `NEXT_PUBLIC_WS_URL` | Base Socket.IO (stesso host dell’API in molti setup, **senza** `/api`). |

**Importante:** `NEXT_PUBLIC_*` sono **iniettate in build time**. Dopo un cambio dominio devi **ricostruire** l’immagine / il build Next.

---

## Esempi locali

- `apps/api/.env.example` → copia in `apps/api/.env`
- `apps/web/.env.example` → copia in `apps/web/.env.local`

---

## Database

```bash
cd apps/api
npx prisma migrate deploy
npx prisma generate
```

In sviluppo: `npx prisma migrate dev`.

---

## Docker (stack completo)

File: `docker-compose.prod.yml`, immagini `deploy/Dockerfile.api` e `deploy/Dockerfile.web`.

1. Copia `.env.prod.example` in `.env` nella root (o passa `--env-file`).
2. Imposta almeno `JWT_SECRET`, `POSTGRES_PASSWORD`, `NEXT_PUBLIC_*`, `CORS_ORIGIN`, `SOCKET_CORS_ORIGIN`, `FRONTEND_URL`, e credenziali **LiveKit** se servono le dirette.
3. Avvio:

```bash
docker compose -f docker-compose.prod.yml --env-file .env up --build -d
```

- **API** espone `4000`, **Web** `3000`, **Postgres** solo rete interna compose.
- L’entrypoint API esegue **`prisma migrate deploy`** ad ogni avvio (dopo Postgres healthy).

### Redis (opzionale)

```bash
docker compose -f docker-compose.prod.yml --profile redis up -d redis
```

Poi imposta `REDIS_URL=redis://redis:6379` sull’API.

### Build manuali

```bash
npm run docker:build:api
npm run docker:build:web
```

(Passare `--build-arg` coerenti con `docker:build:web` per URL pubblici.)

---

## CI

Workflow GitHub Actions: `.github/workflows/ci.yml` (install, `prisma generate`, build API e web).

---

## Post-deploy (smoke test)

- `GET /api/health`
- Registrazione / login
- Wallet (se Stripe attivo)
- Join live con LiveKit configurato
- Tip, galleria (acquisto), chat in diretta (JWT obbligatorio)

---

## Cosa non è nel repository

- Account e provisioning su **cloud** (VPS, Kubernetes, Railway, Fly, ecc.).
- **Certificati TLS** e DNS (metti un reverse proxy tipo Caddy/Traefik/Nginx davanti a `web` e `api`).
- **LiveKit Cloud** o server self-hosted.
- **Stripe** (`STRIPE_*`) e URL webhook HTTPS pubblico.

Aggiorna questo file quando aggiungi moduli o nuove variabili.
