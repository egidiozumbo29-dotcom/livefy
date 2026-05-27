# Supabase + Synthra API

## 1. Connection string

Nel progetto Supabase: **Settings → Database → Connection string → URI**  
Usa la **Direct connection** (porta **5432**).

In **`apps/api/.env`** (crea il file da `.env.example`):

```env
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres?schema=public"
DIRECT_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres?schema=public"
```

Sostituisci `[PASSWORD]` (caratteri speciali → URL-encode, es. `@` → `%40`).

## 2. Crea le tabelle (scegli uno)

**Consigliato** — da **`apps/api`**:

```bash
npx prisma migrate deploy
npm run db:seed
```

**Oppure** — SQL Editor su Supabase: incolla tutto il file  
`apps/api/prisma/migrations/20260207120000_init/migration.sql` ed esegui,  
poi `apps/api/sql/supabase_seed_demo.sql` per l’utente demo.

## 3. Avvio

Dalla **root** del monorepo:

```bash
npm run dev:api
```

Prova: http://localhost:4000/api/health

## 4. Frontend

`apps/web/.env.local` deve avere:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

Poi `npm run dev:web` dalla root.

## Login demo (dopo seed)

- Email: `streamer@demo.synthra`
- Password: `StreamerDemo123!`
