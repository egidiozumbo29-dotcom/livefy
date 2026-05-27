# Owner Hub

Dashboard centralizzata multi-piattaforma. Ogni piattaforma di proprietà invia
eventi (tip, payout, signup, ecc.) a questo hub via HTTP. Il hub conserva i
dati in un database Postgres dedicato e li mostra in una dashboard a cui
accede solo il proprietario, via magic link.

## Architettura

```
[Piattaforma 1] ──┐
[Piattaforma 2] ──┼──► POST /api/events  ──►  Postgres Owner Hub  ──►  Dashboard /
[Piattaforma 3] ──┤
[Piattaforma N] ──┘
```

- Ogni piattaforma usa il pattern **Outbox**: scrive l'evento nel proprio DB
  nella stessa transazione di business, e un job in background lo POSTa al hub
  con retry. In questo modo nessun evento viene perso anche se l'hub è giù.
- Idempotenza: l'hub deduplica per `(platformId, externalId)`.

## Setup locale

1. Avvia un Postgres dedicato (es. `localhost:5435`).
2. Copia `.env.example` in `.env` e configura `OWNER_HUB_DATABASE_URL`,
   `OWNER_INGEST_TOKEN`, `OWNER_ALLOWED_EMAILS`, `OWNER_HUB_URL`.
3. Installa: `npm install`
4. Genera client + crea schema: `npm run prisma:generate && npm run db:push`
5. Avvia: `npm run dev` (porta 3100)
6. Vai su <http://localhost:3100/login>, inserisci la tua email autorizzata,
   il magic link verrà stampato in console (in dev senza SMTP).

## Contratto eventi (per integrare nuove piattaforme)

POST `/api/events` con header `Authorization: Bearer <OWNER_INGEST_TOKEN>`:

```json
{
  "platform": {
    "id": "livefy",
    "name": "Livefy",
    "apiUrl": "https://api.livefy.example"
  },
  "events": [
    {
      "externalId": "tip_<uuid>",
      "type": "TIP",
      "occurredAt": "2026-05-27T19:00:00.000Z",
      "userId": "user_123",
      "username": "demo_streamer",
      "amountTokens": 100,
      "amountEur": 5.0,
      "currency": "EUR",
      "meta": { "streamId": "..." }
    }
  ]
}
```

### Tipi evento standard

| `type`              | Significato                                  |
| ------------------- | -------------------------------------------- |
| `TIP`               | Tip ricevuto da un creator                   |
| `STREAM_ACCESS`     | Acquisto accesso a stream paid               |
| `GALLERY_PURCHASE`  | Acquisto contenuto galleria                  |
| `PAYOUT_REQUESTED`  | Modella richiede prelievo                    |
| `PAYOUT_PAID`       | Bonifico effettuato (uscita per il business) |
| `OWNER_REVENUE`     | Quota netta owner (es. trattenuta 40%)       |
| `USER_SIGNUP`       | Nuova registrazione utente                   |
| `USER_LOGIN`        | Login (campionato, opzionale)                |

### Regole

- `externalId` deve essere unico per piattaforma. Suggerito: `<type>_<dbId>`.
- `occurredAt` è il timestamp **dell'evento di business**, non quello di invio.
- `amountEur` opzionale ma fortemente consigliato per le voci monetarie.
- I dati sono immutabili: per correggere, invia un evento di compensazione.

## Sicurezza

- Magic link (TTL 15 min) + sessione cookie (TTL 30 giorni).
- Email allowlist via `OWNER_ALLOWED_EMAILS`.
- Token ingest separato dalle credenziali utente.

## TODO

- Integrazione SMTP/Resend per invio reale magic link.
- Grafici time-series per trend.
- Esport CSV/Excel.
- Job di rollup giornaliero (`DailyRollup`) per query veloci su lunghi periodi.
