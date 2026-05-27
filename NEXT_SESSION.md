# Prossima sessione

## Stato

- ✅ Step 12 DASHBOARD CREATOR — completo (Studio in `/studio` con tab Live / Tip menu / Galleria / Analytics / Moderazione / Payout).
- ✅ Smoke test locale — superato (auth, users/me, analytics, streams, discovery, messages, web SSR).
- ✅ Bug fixati durante smoke test:
  - Migration mancante `Message.mediaUrl` / `mediaType` → aggiunta `20260524160000_message_media`.
  - 4 warning ESLint `<img>` → disable comment giustificato.
  - Warning visibile in console al boot API quando mancano LiveKit/Stripe/Redis.
- ✅ `deploy/Caddyfile.example` aggiunto per reverse proxy con HTTPS automatico.

## Da fare per andare in produzione (richiede te)

1. **Account LiveKit Cloud** — https://cloud.livekit.io → progetto nuovo → copia `URL`, `API Key`, `API Secret` in `.env` di prod.
2. **Account Stripe** — https://dashboard.stripe.com → secret key + webhook endpoint `https://api.tuodominio.com/api/payments/webhook` → copia `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET`.
3. **VPS** (es. Hetzner CX22 ~4€/mese) + **dominio** (~10€/anno).
4. **DNS** — `A www.tuodominio.com → IP_VPS`, `A api.tuodominio.com → IP_VPS`.
5. Sul VPS: `git clone`, `cp .env.prod.example .env`, riempi tutte le var, `docker compose -f docker-compose.prod.yml --env-file .env up --build -d`.
6. Installa Caddy sul VPS (o container) usando `deploy/Caddyfile.example` (sostituisci `tuodominio.com`).
7. Configura webhook Stripe sull'URL pubblico HTTPS dopo step 5-6.

## Setup dev locale (per riprendere veloce)

```bash
docker compose up -d              # Postgres su 5434
cd apps/api && npx prisma migrate deploy && npm run db:seed
cd ../.. && npm run dev           # API :4000 + Web :3000
```

Login demo: `streamer@demo.synthra` / `StreamerDemo123!`

## Idee feature future (non urgenti)

- Schedule live programmate (notifica follower)
- Export CSV earnings/payout
- 2FA login
- Notifiche push browser
- Profilo creator: badge verifica visibile, statistiche pubbliche
- Sistema referral
- Goal di tip durante live
- VOD: registrazione live e replay a pagamento

## Note tecniche

- 4 `<img>` su URL utente arbitrari hanno `eslint-disable @next/next/no-img-element` documentato. Non convertire a `next/image` senza prima whitelistare i domini in `next.config.ts → images.remotePatterns`.
- `next lint` deprecato in Next 16 (ok su Next 15.1 attuale).
- Brand prodotto = "Synthra" (UI, manifest PWA, eventi runtime, chiavi localStorage); "Livefy" è solo nome repo. **NON** rinominare senza piano migrazione storage.
- Avviso Prisma 6→7 disponibile (`npm i --save-dev prisma@latest && npm i @prisma/client@latest`) — non urgente.
- LiveKit container nel docker-compose dev resta in restart loop (config non completata): non blocca lo sviluppo, le dirette girano comunque solo con LiveKit Cloud reale.
