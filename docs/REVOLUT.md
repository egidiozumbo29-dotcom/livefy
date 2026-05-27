# Revolut Business end-to-end

Questa guida spiega come abilitare i pagamenti reali per i token pack (`/wallet`) usando Revolut Business Merchant.

## 1. Credenziali API

Nel pannello Revolut Business abilita Merchant / Payment Acceptance e crea una API key Merchant.

Nel file `.env` dell'API o nello `.env` di produzione imposta:

```env
REVOLUT_API_BASE_URL=https://merchant.revolut.com
REVOLUT_API_KEY="xxx"
REVOLUT_API_VERSION=2024-09-01
FRONTEND_URL="https://www.tuodominio.com"
```

In sandbox usa la base URL sandbox indicata da Revolut Business.

## 2. Token pack disponibili

I pack sono definiti in `apps/api/src/payments/token-packs.catalog.ts`.

Il frontend legge il catalogo da:

```http
GET /api/payments/token-packs
```

## 3. Flusso pagamento

1. Utente loggato apre `/wallet`.
2. Click su "Acquista" su un pack.
3. Il frontend chiama `POST /api/payments/checkout-session`.
4. Il backend crea un ordine Revolut Merchant con importo, valuta, descrizione e metadata (`userId`, `tokens`, `packKey`).
5. Il browser viene rediretto alla Hosted Checkout Page Revolut.
6. Revolut redirige a `/wallet?paid=1` oppure `/wallet?cancel=1`.
7. Revolut invia il webhook a `https://api.tuodominio.com/api/payments/webhook`.
8. Il backend recupera l'ordine da Revolut server-to-server e accredita i token solo se `state = COMPLETED`.

## 4. Webhook

Configura su Revolut Business il webhook pubblico HTTPS:

```text
https://api.tuodominio.com/api/payments/webhook
```

L'endpoint usa il raw body NestJS e non accredita token basandosi solo sul payload ricevuto: prima recupera l'ordine tramite Merchant API.

## 5. Idempotenza

L'accredito è idempotente tramite:

```text
Transaction.externalId = Revolut order id
```

Se Revolut invia lo stesso webhook più volte, il balance non viene incrementato due volte.

## 6. Troubleshooting

- **503 revolut_non_configurato**: manca `REVOLUT_API_KEY`.
- **checkout_url_mancante**: Revolut non ha restituito una Hosted Checkout URL; controlla credenziali/API version/base URL.
- **Balance non aggiornato**: verifica che il webhook Revolut sia configurato e che l'ordine risulti `COMPLETED` nella dashboard Revolut.
