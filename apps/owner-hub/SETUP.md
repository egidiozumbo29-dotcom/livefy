# Owner Hub - Setup e stato attuale

Documento operativo: tutto cio che e' stato configurato il 27/05/2026.
Tienilo aggiornato quando aggiungi piattaforme o cambi credenziali.

---

## 1. Cos'e' l'Owner Hub

App standalone su `apps/owner-hub` che aggrega in tempo reale tutti gli eventi
finanziari di N piattaforme (oggi: solo Livefy). Mostra una dashboard con KPI
globali e per-piattaforma: ricavi lordi, payout pagati, profitto netto owner,
signup, eventi, ecc.

Architettura:

- **Piattaforma X** -> scrive in tabella `OutboxEvent` (atomico col business)
- **Job flusher X** -> POST `/api/events` al Hub ogni 30s con retry
- **Hub** (Next.js + Postgres dedicato) -> verifica token, deduplica, salva,
  mostra in `/`

---

## 2. URL e porte

| Servizio              | URL                          | Note                                 |
|-----------------------|------------------------------|--------------------------------------|
| Owner Hub web         | http://localhost:3100        | dashboard + login + ingest           |
| Postgres Hub          | localhost:5435               | DB `owner_hub`, user `postgres`      |
| Postgres Livefy       | localhost:5434               | DB `livefy`                          |
| Livefy API            | http://localhost:4000        | NestJS, vedi `apps/api`              |
| Livefy Web            | http://localhost:3000        | Next, vedi `apps/web`                |

---

## 3. Credenziali / variabili d'ambiente

### apps/owner-hub/.env

```
OWNER_HUB_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5435/owner_hub?schema=public"
OWNER_INGEST_TOKEN="change-me-to-a-long-random-secret"  # condiviso con tutte le piattaforme
OWNER_ALLOWED_EMAILS="egidiozumbo29@gmail.com"
OWNER_HUB_SECRET="change-me-to-a-32+char-random-string"
OWNER_HUB_URL="http://localhost:3100"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="egidiozumbo29@gmail.com"
SMTP_PASS="<App Password Gmail 16 char>"
SMTP_FROM="Owner Hub <egidiozumbo29@gmail.com>"
```

### apps/api/.env (aggiunte per Livefy -> Hub)

```
OWNER_HUB_URL=http://localhost:3100
OWNER_INGEST_TOKEN=change-me-to-a-long-random-secret  # IDENTICO a quello del hub
OWNER_PLATFORM_ID=livefy
OWNER_PLATFORM_NAME=Livefy
TOKEN_EUR_RATE=0.05
MODEL_PAYOUT_WITHHOLD_PERCENT=40
```

> IMPORTANTE: in produzione cambia `OWNER_INGEST_TOKEN` e `OWNER_HUB_SECRET` con
> stringhe random lunghe (>= 64 e >= 32 char). Devi propagare il primo a tutte
> le piattaforme che si collegano al hub.

---

## 4. Login dashboard

1. Vai su http://localhost:3100/login
2. Inserisci `egidiozumbo29@gmail.com`
3. Premi "Invia link" -> il magic link arriva via Gmail
4. Cliccalo -> sessione valida 30 giorni

### Se l'email non arriva (dev) o serve un link al volo

```
cd apps/owner-hub
node scripts/gen-magic-link.js egidiozumbo29@gmail.com
```

Stampa un URL `http://localhost:3100/api/auth/verify?token=...` da incollare nel
browser. Vale 15 minuti.

---

## 5. Avvio servizi

In ordine:

```
# Postgres (entrambi i container)
docker compose up -d

# API Livefy
cd apps/api && npm run start:dev

# Web Livefy
cd apps/web && npm run dev

# Owner Hub
cd apps/owner-hub && npm run dev
```

Oppure dalla root: `npm run dev` lancia API+Web insieme. Il Hub e' un comando
separato (`npm run dev:hub`).

---

## 6. Schema eventi (contratto Hub)

Endpoint: `POST {OWNER_HUB_URL}/api/events`
Header: `Authorization: Bearer {OWNER_INGEST_TOKEN}`
Body:

```json
{
  "platform": { "id": "livefy", "name": "Livefy", "apiUrl": "https://api.livefy.com" },
  "events": [
    {
      "externalId": "tip_abc123",
      "type": "TIP",
      "occurredAt": "2026-05-27T22:00:00.000Z",
      "userId": "u_456",
      "username": "creator_x",
      "amountTokens": 200,
      "amountEur": 10.0,
      "currency": "EUR",
      "meta": { "streamId": "s_789" }
    }
  ]
}
```

Tipi evento gestiti:

- `TIP`
- `STREAM_ACCESS` (spy/private/base)
- `GALLERY_PURCHASE`
- `USER_SIGNUP`
- `PAYOUT_REQUESTED`
- `PAYOUT_PAID`
- `OWNER_REVENUE` (la tua quota netta)

---

## 7. Come Livefy invia gli eventi

Pattern Outbox (consegna affidabile):

1. **Tabella** `OutboxEvent` in `apps/api/prisma/schema.prisma`
2. **OutboxService** (`apps/api/src/outbox/outbox.service.ts`): metodo
   `write(tx, event)` che scrive nella stessa transazione del business
3. **OutboxFlusher** (`apps/api/src/outbox/outbox.flusher.ts`): ogni 30s
   prende eventi non inviati e li POSTa al hub, con retry su errore
4. **Hook installati** in:
   - `tips/tips.service.ts` -> TIP
   - `streams/streams.service.ts` -> STREAM_ACCESS (spy/base/private)
   - `creators/creators.service.ts` -> GALLERY_PURCHASE
   - `payouts/payouts.service.ts` -> PAYOUT_REQUESTED, PAYOUT_PAID, OWNER_REVENUE
   - `auth/auth.service.ts` -> USER_SIGNUP

---

## 8. Come collegare una nuova piattaforma

Vedi sezione dedicata in `apps/owner-hub/README.md`. Sintesi:

1. Aggiungi tabella `OutboxEvent` nel suo DB
2. Copia `OutboxService` + `OutboxFlusher` (o re-implementa in altro stack)
3. Nel `.env` della nuova piattaforma:
   ```
   OWNER_HUB_URL=http://localhost:3100   # o dominio prod
   OWNER_INGEST_TOKEN=<stesso del hub>
   OWNER_PLATFORM_ID=nome-univoco
   OWNER_PLATFORM_NAME=NomeBrand
   ```
4. Chiama `outbox.write(tx, {...})` nei service di business

---

## 9. Comandi utili

```
# Genera magic link al volo (se SMTP down o serve link diretto)
node apps/owner-hub/scripts/gen-magic-link.js egidiozumbo29@gmail.com

# Rigenera Prisma client Hub
cd apps/owner-hub && npx prisma generate

# Applica schema al DB Hub (dev)
cd apps/owner-hub && npx prisma db push

# Aggiorna SMTP password
node apps/owner-hub/scripts/set-smtp-pass.js "nuova-app-password"

# Reset DB Hub (cancella tutti gli eventi raccolti!)
docker compose down -v && docker compose up -d
cd apps/owner-hub && npx prisma db push
```

---

## 10. TODO produzione

Prima di deployare il hub fuori da localhost:

- [ ] Cambia `OWNER_INGEST_TOKEN` con stringa random >= 64 char (e propaga a tutte le piattaforme)
- [ ] Cambia `OWNER_HUB_SECRET` con stringa random >= 32 char
- [ ] Deploya hub su hosting con HTTPS (Railway/Fly.io/VPS + Caddy)
- [ ] Crea Postgres backup-ato per il hub (Supabase/Neon vanno bene)
- [ ] Punta `OWNER_HUB_URL` al dominio reale in tutti gli `.env`
- [ ] Configura record SPF/DKIM per evitare che Gmail finisca in spam
- [ ] Aggiungi rate limiting all'endpoint ingest (oggi e' solo Bearer token)
- [ ] Backup automatico DB hub (rpo orario consigliato)

---

## 11. Stato lavoro al 27/05/2026

Completato:

- Scaffold Owner Hub: Next.js 14 + Prisma + Postgres dedicato (porta 5435)
- Schema Hub: `Platform`, `AnalyticsEvent`, `DailyRollup`, `MagicLinkToken`, `OwnerSession`
- Login magic link via Gmail SMTP (App Password configurata)
- Endpoint ingest `POST /api/events` con Bearer auth + idempotenza
- Dashboard KPI globali e per-piattaforma con filtro data
- Schema Livefy: aggiunto modello `OutboxEvent` + migration `20260527200000_add_outbox_event`
- Modulo Livefy: `OutboxModule` (service + flusher) registrato come global
- Hook outbox completati in tutti i service di business (tips, streams, gallery, payouts, auth)

Aperto / non fatto:

- Una sola piattaforma collegata (Livefy). Le altre 3 si attaccano con lo stesso pattern.
- SMTP_HOST in dev e' Gmail. Per volumi alti passare a Resend/Postmark.
- Nessun grafico time-series nella dashboard (solo tabella). Aggiungibile con Recharts.
- Export CSV/Excel non implementato.
- Job rollup giornaliero su `DailyRollup` non ancora attivo (utile sopra i 100k eventi).
