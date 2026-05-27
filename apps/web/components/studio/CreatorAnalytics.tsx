"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/services/api";
import { formatInteger, formatIsoUtc } from "@/lib/format";

type Analytics = {
  earnings: {
    creatorBalance: number;
    grossLifetimeTokens: number;
    grossLast7dTokens: number;
    estimatedNetLifetimeTokens: number;
    estimatedNetLast7dTokens: number;
    feePercent: number;
    sources: {
      tips: SourceStats;
      paidAccess: SourceStats;
      gallery: SourceStats;
    };
  };
  audience: {
    followers: number;
    followersLast7d: number;
    profileVisits: number;
    profileVisitsLast7d: number;
  };
  realtime: {
    isLive: boolean;
    streamId: string | null;
    title: string | null;
    viewers: number;
    showMode: string | null;
    chatOpen: boolean | null;
    startedAt: string | null;
    activeAccesses: number;
    inPrivateShow: boolean;
  };
  livestreams: {
    totalCount: number;
    recentCount: number;
    totalLiveMinutes: number;
    avgLiveMinutes: number;
    peakViewers: number;
    peakStreamTitle: string | null;
    recent: StreamStat[];
  };
  daily: { date: string; tipTokens: number; tipCount: number }[];
  followers: number;
  tipsLifetimeCount: number;
  tipsLifetimeTokens: number;
  tipsLast7dCount: number;
  tipsLast7dTokens: number;
  topTippersLast7d: {
    sender?: { id: string; username: string; avatarUrl: string | null };
    tokens: number;
  }[];
  peakViewers: number;
  peakStreamTitle: string | null;
  topSupporters: {
    rank: number;
    sender?: { id: string; username: string; avatarUrl: string | null };
    tokens: number;
    tipCount: number;
  }[];
};

type SourceStats = {
  lifetimeTokens: number;
  last7dTokens: number;
  lifetimeCount: number;
  last7dCount: number;
};

type StreamStat = {
  id: string;
  title: string;
  status: string;
  showMode: string;
  viewers: number;
  startedAt: string | null;
  endedAt: string | null;
  durationMinutes: number;
  tipCount: number;
  accessCount: number;
  tipTokens: number;
  accessTokens: number;
};

export function CreatorAnalytics() {
  const [data, setData] = useState<Analytics | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await apiFetch("/creators/me/analytics");
      if (!r.ok) {
        setErr(`Errore ${r.status}`);
        return;
      }
      setData((await r.json()) as Analytics);
    } catch {
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 15_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  if (err) {
    return (
      <p className="rounded-md border border-amber-500/35 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
        {err}
      </p>
    );
  }

  if (!data) {
    return <p className="text-sm text-cam-muted">Carico...</p>;
  }

  const maxDaily = Math.max(1, ...data.daily.map((d) => d.tipTokens));

  return (
    <div className="space-y-6">
      <header className="rounded-md border border-cam-border bg-gradient-to-br from-cam-card via-cam-ink to-cam-bg p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-cam-orange-bright">
              Creator dashboard
            </p>
            <h2 className="mt-1 text-xl font-bold text-cam-text">
              Earnings, audience e live performance
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-cam-muted">
              Dati aggiornati automaticamente ogni 15 secondi durante la live.
              I netti sono stimati usando la fee piattaforma configurata.
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="rounded-full border border-cam-border px-3 py-1.5 text-xs font-semibold text-cam-muted hover:border-cam-orange hover:text-cam-orange-bright disabled:opacity-50"
          >
            {loading ? "Aggiorno..." : "Aggiorna"}
          </button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Disponibile per prelievo"
          value={data.earnings.creatorBalance}
          suffix="tk"
          tone="green"
          delta="Netto cumulato (al netto fee e payout)"
        />
        <Stat
          label="Earnings 7gg (netto)"
          value={data.earnings.estimatedNetLast7dTokens}
          suffix="tk"
          delta={`Lordo: ${formatInteger(data.earnings.grossLast7dTokens)} tk · fee ${data.earnings.feePercent}%`}
        />
        <Stat label="Follower" value={data.audience.followers} delta={`+${formatInteger(data.audience.followersLast7d)} 7gg`} />
        <Stat label="Viewer realtime" value={data.realtime.viewers} delta={data.realtime.isLive ? "Live ora" : "Offline"} tone={data.realtime.isLive ? "red" : "muted"} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-md border border-cam-border bg-cam-card p-5 shadow-card">
          <SectionTitle title="Earnings" subtitle={`Fee piattaforma: ${data.earnings.feePercent}%`} />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <SourceCard label="Tip" stats={data.earnings.sources.tips} />
            <SourceCard label="Ticket / Premium" stats={data.earnings.sources.paidAccess} />
            <SourceCard label="Galleria" stats={data.earnings.sources.gallery} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MiniStat label="Lordo lifetime" value={data.earnings.grossLifetimeTokens} />
            <MiniStat label="Netto stimato lifetime" value={data.earnings.estimatedNetLifetimeTokens} />
            <MiniStat label="Lordo ultimi 7gg" value={data.earnings.grossLast7dTokens} />
            <MiniStat label="Netto stimato 7gg" value={data.earnings.estimatedNetLast7dTokens} />
          </div>
        </div>

        <div className="rounded-md border border-cam-border bg-cam-card p-5 shadow-card">
          <SectionTitle title="Viewers realtime" subtitle={data.realtime.isLive ? "Diretta attiva" : "Nessuna live attiva"} />
          <div className="mt-4 rounded-md border border-cam-border bg-cam-ink p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-cam-muted">
              Stato
            </p>
            <p className={`mt-2 text-2xl font-black ${data.realtime.isLive ? "text-red-300" : "text-cam-muted"}`}>
              {data.realtime.isLive ? "LIVE" : "OFFLINE"}
            </p>
            <p className="mt-1 text-sm text-cam-text">
              {data.realtime.title || "Nessuna live in corso"}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <MiniStat label="Viewer" value={data.realtime.viewers} compact />
              <MiniStat label="Accessi attivi" value={data.realtime.activeAccesses} compact />
              <MiniText label="Modalità" value={data.realtime.showMode ?? "-"} />
              <MiniText label="Chat" value={data.realtime.chatOpen == null ? "-" : data.realtime.chatOpen ? "aperta" : "chiusa"} />
            </div>
            {data.realtime.startedAt && (
              <p className="mt-3 text-[11px] text-cam-muted">
                Start: {formatIsoUtc(data.realtime.startedAt)}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-md border border-cam-border bg-cam-card p-5 shadow-card">
          <SectionTitle title="Analytics audience" subtitle="Follower, visite profilo e crescita recente" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MiniStat label="Follower totali" value={data.audience.followers} />
            <MiniStat label="Nuovi follower 7gg" value={data.audience.followersLast7d} />
            <MiniStat label="Visite profilo" value={data.audience.profileVisits} />
            <MiniStat label="Visite 7gg" value={data.audience.profileVisitsLast7d} />
          </div>
        </div>

        <div className="rounded-md border border-cam-border bg-cam-card p-5 shadow-card">
          <SectionTitle title="Trend tip ultimi 7 giorni" subtitle="Token e numero di tip giornalieri" />
          <div className="mt-5 flex h-44 items-end gap-2 rounded-md border border-cam-border bg-cam-ink p-3">
            {data.daily.map((day) => (
              <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <div className="flex h-28 w-full items-end rounded bg-cam-bg/70">
                  <div
                    className="w-full rounded-t bg-cam-cta"
                    style={{ height: `${Math.max(4, (day.tipTokens / maxDaily) * 100)}%` }}
                    title={`${day.date}: ${formatInteger(day.tipTokens)} tk`}
                  />
                </div>
                <span className="text-[10px] text-cam-muted">{day.date.slice(5)}</span>
                <span className="text-[10px] font-bold text-cam-text">{formatInteger(day.tipTokens)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Supporters title="Top supporters lifetime" rows={data.topSupporters} empty="Nessun supporter ancora." />
        <Supporters
          title="Top supporters ultimi 7 giorni"
          rows={data.topTippersLast7d.map((row, idx) => ({
            rank: idx + 1,
            sender: row.sender,
            tokens: row.tokens,
            tipCount: 0,
          }))}
          empty="Nessuna mancia ricevuta nell'ultima settimana."
        />
      </section>

      <section className="rounded-md border border-cam-border bg-cam-card p-5 shadow-card">
        <SectionTitle
          title="Statistiche livestream"
          subtitle={`${formatInteger(data.livestreams.totalCount)} live totali · media ${formatInteger(data.livestreams.avgLiveMinutes)} min · picco ${formatInteger(data.livestreams.peakViewers)} viewer`}
        />
        {data.livestreams.recent.length === 0 ? (
          <p className="mt-4 text-sm text-cam-muted">Nessuna live ancora.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-cam-muted">
                <tr className="border-b border-cam-border">
                  <th className="py-2 pr-4">Live</th>
                  <th className="py-2 pr-4">Stato</th>
                  <th className="py-2 pr-4">Durata</th>
                  <th className="py-2 pr-4">Picco</th>
                  <th className="py-2 pr-4">Tip</th>
                  <th className="py-2 pr-4">Accessi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cam-border">
                {data.livestreams.recent.map((stream) => (
                  <tr key={stream.id} className="text-cam-text">
                    <td className="py-3 pr-4">
                      <p className="max-w-xs truncate font-semibold">{stream.title}</p>
                      <p className="text-[11px] text-cam-muted">
                        {stream.startedAt ? formatIsoUtc(stream.startedAt) : "-"} · {stream.showMode}
                      </p>
                    </td>
                    <td className="py-3 pr-4">{stream.status}</td>
                    <td className="py-3 pr-4 tabular-nums">{formatInteger(stream.durationMinutes)} min</td>
                    <td className="py-3 pr-4 tabular-nums">{formatInteger(stream.viewers)}</td>
                    <td className="py-3 pr-4 tabular-nums">
                      {formatInteger(stream.tipTokens)} tk · {formatInteger(stream.tipCount)}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">
                      {formatInteger(stream.accessTokens)} tk · {formatInteger(stream.accessCount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
  delta,
  tone = "orange",
}: {
  label: string;
  value: number;
  suffix?: string;
  delta?: string;
  tone?: "orange" | "green" | "red" | "muted";
}) {
  const color =
    tone === "green"
      ? "text-emerald-300"
      : tone === "red"
        ? "text-red-300"
        : tone === "muted"
          ? "text-cam-muted"
          : "text-cam-orange-bright";
  return (
    <div className="rounded-md border border-cam-border bg-cam-card p-5 shadow-card">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-cam-muted">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${color}`}>
        {formatInteger(value)}
        {suffix && <span className="ml-1 text-xs font-semibold">{suffix}</span>}
      </p>
      {delta && <p className="mt-1 text-[11px] text-cam-muted">{delta}</p>}
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header>
      <h3 className="text-sm font-bold uppercase tracking-wider text-cam-text">
        {title}
      </h3>
      {subtitle && <p className="mt-1 text-xs text-cam-muted">{subtitle}</p>}
    </header>
  );
}

function SourceCard({ label, stats }: { label: string; stats: SourceStats }) {
  return (
    <div className="rounded-md border border-cam-border bg-cam-ink px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-cam-muted">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold tabular-nums text-cam-orange-bright">
        {formatInteger(stats.lifetimeTokens)} tk
      </p>
      <p className="mt-1 text-[11px] text-cam-muted">
        7gg: {formatInteger(stats.last7dTokens)} tk · {formatInteger(stats.last7dCount)} eventi
      </p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: number;
  compact?: boolean;
}) {
  return (
    <div className="rounded-md border border-cam-border bg-cam-ink px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-cam-muted">
        {label}
      </p>
      <p className={`${compact ? "text-lg" : "text-xl"} mt-1 font-bold tabular-nums text-cam-text`}>
        {formatInteger(value)}
      </p>
    </div>
  );
}

function MiniText({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-cam-border bg-cam-ink px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-cam-muted">
        {label}
      </p>
      <p className="mt-1 truncate text-lg font-bold text-cam-text">{value}</p>
    </div>
  );
}

function Supporters({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: {
    rank: number;
    sender?: { id: string; username: string; avatarUrl: string | null };
    tokens: number;
    tipCount: number;
  }[];
  empty: string;
}) {
  return (
    <section className="rounded-md border border-cam-border bg-cam-card p-5 shadow-card">
      <SectionTitle title={title} />
      {rows.length === 0 ? (
        <p className="mt-3 text-xs text-cam-muted">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-cam-border overflow-hidden rounded-md border border-cam-border">
          {rows.map((row, i) => (
            <li
              key={row.sender?.id ?? i}
              className="flex items-center justify-between gap-3 bg-cam-ink px-3 py-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="w-6 shrink-0 text-xs font-black text-cam-orange-bright">
                  #{row.rank}
                </span>
                <Avatar src={row.sender?.avatarUrl ?? null} />
                <span className="min-w-0">
                  <span className="block truncate text-cam-text">
                    {row.sender?.username ?? "anon"}
                  </span>
                  {row.tipCount > 0 && (
                    <span className="block text-[10px] text-cam-muted">
                      {formatInteger(row.tipCount)} tip
                    </span>
                  )}
                </span>
              </span>
              <span className="shrink-0 tabular-nums font-bold text-cam-orange-bright">
                {formatInteger(row.tokens)} tk
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Avatar({ src }: { src: string | null }) {
  return (
    <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-cam-card">
      {src && (
        <Image
          src={src}
          alt=""
          fill
          sizes="32px"
          className="object-cover"
          unoptimized
        />
      )}
    </span>
  );
}
