import { redirect } from "next/navigation";
import { getSessionEmail } from "@/lib/auth";
import { computeKpis, recentEvents } from "@/lib/metrics";
import { daysAgoUtc, formatEur, formatInteger } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams?: { from?: string; to?: string };
}) {
  const email = await getSessionEmail();
  if (!email) redirect("/login");

  const to = searchParams?.to ? new Date(searchParams.to) : new Date();
  const from = searchParams?.from
    ? new Date(searchParams.from)
    : daysAgoUtc(30);

  const { totals, perPlatform } = await computeKpis({ from, to });
  const events = await recentEvents(40);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent">
            Owner Hub
          </p>
          <h1 className="mt-1 text-3xl font-bold">Dashboard consolidata</h1>
          <p className="mt-1 text-sm text-muted">
            {email} · {from.toISOString().slice(0, 10)} → {to.toISOString().slice(0, 10)}
          </p>
        </div>
        <form className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-muted">
            Da
            <input
              type="date"
              name="from"
              defaultValue={from.toISOString().slice(0, 10)}
              className="ml-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-muted">
            A
            <input
              type="date"
              name="to"
              defaultValue={to.toISOString().slice(0, 10)}
              className="ml-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded-md border border-border bg-card px-4 py-1.5 text-sm font-semibold hover:border-accent"
          >
            Filtra
          </button>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted hover:text-text"
            >
              Logout
            </button>
          </form>
        </form>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Ricavi lordo" value={formatEur(totals.grossEur)} tone="green" />
        <Kpi label="Payout pagati" value={formatEur(totals.payoutEur)} tone="orange" />
        <Kpi
          label="Profitto netto owner"
          value={formatEur(totals.ownerEur)}
          tone="green"
        />
        <Kpi label="Nuovi utenti" value={formatInteger(totals.signups)} />
        <Kpi label="Eventi totali" value={formatInteger(totals.events)} />
      </section>

      <section className="mt-10 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider">
          Per piattaforma
        </h2>
        {perPlatform.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Nessuna piattaforma ha ancora inviato eventi. Configura
            <code className="mx-1 rounded bg-bg px-1 text-accent">
              OWNER_HUB_URL
            </code>
            e
            <code className="mx-1 rounded bg-bg px-1 text-accent">
              OWNER_INGEST_TOKEN
            </code>
            sulle piattaforme e abilita l&apos;outbox.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-muted">
                <tr className="border-b border-border">
                  <th className="py-2 pr-4">Piattaforma</th>
                  <th className="py-2 pr-4 text-right">Lordo</th>
                  <th className="py-2 pr-4 text-right">Payout</th>
                  <th className="py-2 pr-4 text-right">Owner netto</th>
                  <th className="py-2 pr-4 text-right">Signup</th>
                  <th className="py-2 pr-4 text-right">Eventi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {perPlatform.map((p) => (
                  <tr key={p.platformId}>
                    <td className="py-3 pr-4 font-semibold">{p.platformName}</td>
                    <td className="py-3 pr-4 text-right tabular-nums">
                      {formatEur(p.grossEur)}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums">
                      {formatEur(p.payoutEur)}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums text-emerald-300">
                      {formatEur(p.ownerEur)}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums">
                      {formatInteger(p.signups)}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums">
                      {formatInteger(p.events)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider">
          Ultimi eventi
        </h2>
        {events.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nessun evento registrato.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-muted">
                <tr className="border-b border-border">
                  <th className="py-2 pr-4">Data</th>
                  <th className="py-2 pr-4">Piattaforma</th>
                  <th className="py-2 pr-4">Tipo</th>
                  <th className="py-2 pr-4">Utente</th>
                  <th className="py-2 pr-4 text-right">Token</th>
                  <th className="py-2 pr-4 text-right">EUR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.map((ev) => (
                  <tr key={ev.id}>
                    <td className="py-2 pr-4 text-xs text-muted">
                      {ev.occurredAt.toISOString().replace("T", " ").slice(0, 19)}
                    </td>
                    <td className="py-2 pr-4">{ev.platform.name}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{ev.type}</td>
                    <td className="py-2 pr-4">{ev.username ?? ev.userId ?? "-"}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {ev.amountTokens
                        ? formatInteger(Number(ev.amountTokens.toString()))
                        : "-"}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {ev.amountEur
                        ? formatEur(Number(ev.amountEur.toString()))
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function Kpi({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "green" | "orange";
}) {
  const color =
    tone === "green"
      ? "text-emerald-300"
      : tone === "orange"
        ? "text-accent"
        : "text-text";
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-lg">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
