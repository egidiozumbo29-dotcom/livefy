# Deploy Produzione — Livefy + Owner Hub

Guida passo-passo per mettere online tutto lo stack.
Ultimo aggiornamento: 28/05/2026

---

## Architettura

```
Internet
  │
  ├── livefy.tuodominio.com      → Web (Next.js, porta 3000)
  ├── api.livefy.tuodominio.com  → API NestJS (porta 4000)  ← WebSocket incluso
  └── hub.tuodominio.com         → Owner Hub (Next.js, porta 3100)  [PRIVATO]

Interno (Docker network):
  ├── PostgreSQL Livefy           porta 5432
  ├── PostgreSQL Owner Hub        porta 5432 (network separata)
  └── Redis (opzionale)           porta 6379
```

---

## Prerequisiti

- [ ] Accesso SSH a un VPS (Ubuntu 22+ consigliato) oppure account Railway/Fly.io
- [ ] Docker + Docker Compose installati sul server
- [ ] Dominio registrato con accesso al DNS
- [ ] Account LiveKit Cloud (https://cloud.livekit.io)
- [ ] Account Revolut Merchant (https://merchant.revolut.com)
- [ ] App Password Gmail (https://myaccount.google.com/apppasswords)

---

## Step 1 — Preparazione segreti

Sul tuo PC locale, genera i segreti:

```bash
node -e "const c=require('node:crypto'); \
  console.log('POSTGRES_PASSWORD=' + c.randomBytes(24).toString('hex')); \
  console.log('HUB_POSTGRES_PASSWORD=' + c.randomBytes(24).toString('hex')); \
  console.log('JWT_SECRET=' + c.randomBytes(48).toString('hex')); \
  console.log('OWNER_INGEST_TOKEN=' + c.randomBytes(48).toString('hex')); \
  console.log('OWNER_HUB_SECRET=' + c.randomBytes(32).toString('hex'));"
```

Copia l'output — ti servirà al passo 3.

---

## Step 2 — Push codice sul server

### Opzione A: Git (consigliata)

```bash
# Sul server
git clone https://github.com/<tuo-user>/livefy.git /opt/livefy
cd /opt/livefy
```

### Opzione B: rsync/scp

```bash
rsync -avz --exclude node_modules --exclude .next \
  c:/Users/egidio/Documents/Livefy/ user@tuo-server:/opt/livefy/
```

---

## Step 3 — Creare file .env sul server

```bash
cd /opt/livefy
cp .env.prod.example .env
nano .env   # oppure: vim .env
```

Compila TUTTI i campi. I placeholder `<genera-con-node-crypto>` vanno sostituiti
con i valori generati allo Step 1.

**Campi obbligatori da non dimenticare:**

| Campo | Dove trovarlo |
|-------|---------------|
| `POSTGRES_PASSWORD` | Step 1 |
| `HUB_POSTGRES_PASSWORD` | Step 1 |
| `JWT_SECRET` | Step 1 |
| `OWNER_INGEST_TOKEN` | Step 1 |
| `OWNER_HUB_SECRET` | Step 1 |
| `LIVEKIT_URL` | LiveKit Cloud -> Project -> URL |
| `LIVEKIT_API_KEY` | LiveKit Cloud -> Project -> API Keys |
| `LIVEKIT_API_SECRET` | LiveKit Cloud -> Project -> API Keys |
| `REVOLUT_API_KEY` | Revolut Merchant -> API -> produzione |
| `SMTP_PASS` | Gmail App Password (16 char) |
| `NEXT_PUBLIC_API_URL` | `https://api.livefy.tuodominio.com/api` |
| `NEXT_PUBLIC_WS_URL` | `https://api.livefy.tuodominio.com` |
| `CORS_ORIGIN` | `https://livefy.tuodominio.com` |
| `SOCKET_CORS_ORIGIN` | `https://livefy.tuodominio.com` |
| `FRONTEND_URL` | `https://livefy.tuodominio.com` |
| `OWNER_HUB_URL` | `https://hub.tuodominio.com` |
| `OWNER_ALLOWED_EMAILS` | `egidiozumbo29@gmail.com` |

---

## Step 4 — Build e avvio Docker

```bash
cd /opt/livefy

# Prima build (richiede 5-10 minuti)
docker compose -f docker-compose.prod.yml --env-file .env up --build -d

# Monitora i log
docker compose -f docker-compose.prod.yml logs -f
```

Per i soli log dell'API:

```bash
docker compose -f docker-compose.prod.yml logs api -f
```

---

## Step 5 — HTTPS con Caddy (più semplice di Nginx)

Installa Caddy sul server:

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudflare.com/public/Caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudflare.com/public/Caddy/stable/deb/caddy.list' > /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install caddy
```

Crea `/etc/caddy/Caddyfile`:

```caddy
livefy.tuodominio.com {
    reverse_proxy localhost:3000
}

api.livefy.tuodominio.com {
    reverse_proxy localhost:4000
}

hub.tuodominio.com {
    # Owner Hub: accesso solo tuo! Aggiungi IP whitelist se vuoi
    reverse_proxy localhost:3100
}
```

Avvia Caddy:

```bash
systemctl enable caddy
systemctl start caddy
```

Caddy gestisce i certificati SSL automaticamente (Let's Encrypt).

---

## Step 6 — Configurazione DNS

Nel pannello DNS del tuo dominio, aggiungi:

| Tipo | Nome | Valore |
|------|------|---------|
| A | `livefy` | `<IP del server>` |
| A | `api.livefy` | `<IP del server>` |
| A | `hub` | `<IP del server>` |

Attendi 5-30 minuti per propagazione.

---

## Step 7 — Verifica funzionamento

```bash
# API health check
curl https://api.livefy.tuodominio.com/api/health

# Hub health check
curl -I https://hub.tuodominio.com/login

# Web
curl -I https://livefy.tuodominio.com
```

---

## Step 8 — Test funzionale pre-lancio

Prima di aprire al pubblico, testa manualmente:

- [ ] Registrazione nuovo account
- [ ] Login
- [ ] Acquisto pacchetto token (Revolut)
- [ ] Apertura live stream
- [ ] Invio tip
- [ ] Accesso private/spy/base
- [ ] Acquisto gallery
- [ ] Richiesta payout (come creator)
- [ ] Approvazione payout (come admin da `/admin/payouts`)
- [ ] Evento visibile in Owner Hub entro 30s
- [ ] Login Owner Hub via email (magic link arriva su Gmail)
- [ ] Dashboard Owner Hub mostra dati corretti
- [ ] Mobile responsive
- [ ] WebSocket su HTTPS (live chat funziona)

---

## Step 9 — Monitoraggio e manutenzione

### Aggiornamenti del codice

```bash
cd /opt/livefy
git pull
docker compose -f docker-compose.prod.yml --env-file .env up --build -d
```

### Backup database

```bash
# Backup Livefy DB
docker exec livefy-postgres-1 pg_dump -U postgres livefy > backup_livefy_$(date +%Y%m%d).sql

# Backup Owner Hub DB
docker exec livefy-owner_hub_postgres-1 pg_dump -U postgres owner_hub > backup_hub_$(date +%Y%m%d).sql
```

Automatizza con cron (`crontab -e`):

```cron
0 3 * * * cd /opt/livefy && docker exec livefy-postgres-1 pg_dump -U postgres livefy > /backups/livefy_$(date +\%Y\%m\%d).sql
0 3 * * * cd /opt/livefy && docker exec livefy-owner_hub_postgres-1 pg_dump -U postgres owner_hub > /backups/hub_$(date +\%Y\%m\%d).sql
```

### Generare magic link Hub (emergenza)

```bash
cd /opt/livefy/apps/owner-hub
node scripts/gen-magic-link.js egidiozumbo29@gmail.com
```

### Vedere log errori

```bash
docker compose -f docker-compose.prod.yml logs api --tail=100
docker compose -f docker-compose.prod.yml logs owner_hub --tail=100
```

---

## Opzione alternativa: Railway (zero server management)

Se preferisci non gestire un VPS, Railway è più semplice:

1. Vai su https://railway.app
2. New Project → Deploy from GitHub repo
3. Aggiungi 3 servizi: `api`, `owner_hub`, `web`
4. Aggiungi 2 database Postgres: uno per Livefy, uno per Hub
5. Copia le variabili d'ambiente da `.env.prod.example` nelle impostazioni Railway
6. Railway gestisce HTTPS, deploy automatici, e log centralizzati

Costo indicativo: ~$20-30/mese per tutto lo stack.

---

## Checklist sicurezza finale

- [ ] Tutti i placeholder `<genera-...>` sostituiti con segreti veri
- [ ] `.env` NON committato su git (verificare con `git status`)
- [ ] Owner Hub accessibile solo da IP tuo (opzionale ma consigliato)
- [ ] Backup automatico DB configurato
- [ ] HTTPS attivo su tutti e 3 i domini
- [ ] Revolut in modalità produzione (non sandbox)
- [ ] LiveKit in modalità produzione
- [ ] `PLATFORM_TIP_FEE_PERCENT=30` confermato
- [ ] `TOKEN_EUR_RATE=0.05` confermato (€0.05 per token)
- [ ] `MODEL_PAYOUT_WITHHOLD_PERCENT=40` confermato

---

## Variabili chiave: riepilogo valori

| Variabile | Valore attuale dev | Valore da usare in prod |
|-----------|-------------------|------------------------|
| `PLATFORM_TIP_FEE_PERCENT` | 30 | 30 |
| `TOKEN_EUR_RATE` | 0.05 | 0.05 |
| `MODEL_PAYOUT_WITHHOLD_PERCENT` | 40 | 40 |
| `OWNER_INGEST_TOKEN` | placeholder | generare con node crypto |
| `JWT_SECRET` | dev-placeholder | generare con node crypto |
