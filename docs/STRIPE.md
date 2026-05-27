# Stripe end-to-end (locale)

Questo documento spiega come abilitare i pagamenti reali per i token pack
(`/wallet`) in ambiente locale, usando Stripe in modalita **test**.

## 1. Chiavi API (test mode)

1. Apri https://dashboard.stripe.com/test/apikeys
2. Copia la **Secret key** (`sk_test_...`).
3. Mettila in `apps/api/.env`:

```
STRIPE_SECRET_KEY="sk_test_xxx"
STRIPE_WEBHOOK_SECRET=""   # lo riempiamo al passo 3
FRONTEND_URL="http://localhost:3000"
```

> Senza `STRIPE_SECRET_KEY`, il backend risponde `503 stripe_non_configurato`
> e il front mostra un avviso chiaro al click di "Acquista".

## 2. Token pack disponibili

I pack sono definiti in `apps/api/src/payments/payments.service.ts` (costante
`TOKEN_PACKS`). Default:

| Pack | Token | Prezzo (EUR) |
| ---- | ----- | ------------ |
| 100  | 100   | 9.99         |
| 500  | 500   | 44.99        |
| 1000 | 1000  | 79.99        |

Modifica la costante per aggiungerne / rimuoverne (il front legge da
`GET /payments/token-packs`, nessun cambio frontend richiesto).

## 3. Webhook locale con Stripe CLI

Il backend esige `STRIPE_WEBHOOK_SECRET` per verificare la firma.
La via piu semplice in dev e usare la Stripe CLI, che fa da tunnel locale.

1. Installa la CLI: https://stripe.com/docs/stripe-cli (Windows: `scoop install stripe`).
2. Login una volta:

```powershell
stripe login
```

3. Avvia il forwarding sul webhook locale (l'API gira su `:4000` con prefix `/api`):

```powershell
stripe listen --forward-to http://localhost:4000/api/payments/webhook
```

4. La CLI stampa una riga tipo:

```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxxxxx (^C to quit)
```

5. Copia quel `whsec_...` in `apps/api/.env`:

```
STRIPE_WEBHOOK_SECRET="whsec_xxxxxxxxxxxxxxxx"
```

6. Riavvia il backend (`npm run dev` in root, oppure solo l'API).

## 4. Flusso reale

1. Utente loggato apre `/wallet`.
2. Click su "Acquista" su un pack -> `POST /api/payments/checkout-session`.
3. Backend crea una `Checkout Session` con `success_url=/wallet?paid=1` e
   `cancel_url=/wallet?cancel=1`, e nei `metadata` mette `userId`,
   `tokens`, `packKey`.
4. Browser viene rediretto a `https://checkout.stripe.com/...`.
5. Carta di test consigliata: `4242 4242 4242 4242`, scadenza futura, CVC
   qualsiasi.
6. Stripe redirige a `/wallet?paid=1`.
7. In parallelo Stripe invia `checkout.session.completed` al webhook locale
   (via `stripe listen`). Il backend:
   - verifica la firma,
   - controlla l'idempotenza tramite `Transaction.externalId = session.id`,
   - crea la `Transaction` (status `COMPLETED`),
   - incrementa `User.balance` dei token acquistati.
8. Il frontend, vedendo `?paid=1`, ricarica `/users/me` e aggiorna il balance
   in Redux + localStorage; rinfresca `/wallet/transactions`.

## 5. Annullamento

Click su "Indietro" in Stripe Checkout -> `cancel_url` -> `/wallet?cancel=1`.
Nessuna `Transaction` viene creata.

## 6. Eventi gestiti

Solo `checkout.session.completed` con `payment_status === "paid"`. Eventi di
refund / dispute non sono gestiti automaticamente (TODO):

- `charge.refunded` -> creare `Transaction` con `REFUNDED` e decrementare
  balance.
- `charge.dispute.created` -> alert admin (Slack / email).

## 7. Test rapido senza CLI

Se vuoi solo verificare il flusso UI senza completare il pagamento reale:

1. Lascia `STRIPE_SECRET_KEY` vuoto: il bottone "Acquista" mostrera
   "Stripe non e configurato sul backend".
2. Imposta `STRIPE_SECRET_KEY` ma non `STRIPE_WEBHOOK_SECRET`: il checkout
   funziona, ma il balance non viene aggiornato (manca il webhook).

## 8. Troubleshooting

- **403 / 401 sul checkout**: utente non loggato. Apri `/login`.
- **400 raw_body_richiesto sul webhook**: significa che NestJS non sta
  passando il raw body. Verifica `apps/api/src/main.ts` -> deve esserci
  `NestFactory.create(AppModule, { rawBody: true })`.
- **400 stripe_signature_mancante**: la richiesta non passa da Stripe / CLI.
  Controlla che `stripe listen` sia attivo e punti all'endpoint corretto.
- **Balance non si aggiorna dopo pagamento**: webhook non ricevuto. Guarda
  l'output di `stripe listen`. Il dashboard Stripe (test mode) -> Developers
  -> Webhooks -> CLI events mostra cosa e stato consegnato.
