"use client";

import { Link } from "@/i18n/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { formatInteger } from "@/lib/format";
import { apiFetch } from "@/services/api";
import { useAppSelector } from "@/store/hooks";

type SourceStats = { amount: number; count: number };

type FinanceRow = {
  model: { id: string; username: string; email: string; createdAt: string };
  grossTokens: number;
  creatorNetTokens: number;
  platformFeeTokens: number;
  taxIncludedTokens: number;
  platformNetTokens: number;
  availableForPayoutTokens: number;
  availablePayoutEurGross?: number;
  availablePayoutWithholdEur?: number;
  availablePayoutEurNet?: number;
  payouts: {
    pending: number;
    approved: number;
    paid: number;
    rejected: number;
    count: number;
  };
  sources: {
    tips: SourceStats;
    paidAccess: SourceStats;
    gallery: SourceStats;
  };
};

type FinanceSummary = {
  feePercent: number;
  taxPercent: number;
  tokenEuroRate: number;
  payoutWithholdPercent: number;
  range: { from: string | null; to: string | null };
  totals: {
    grossTokens: number;
    creatorNetTokens: number;
    platformFeeTokens: number;
    taxIncludedTokens: number;
    platformNetTokens: number;
    availableForPayoutTokens: number;
    pendingPayoutTokens: number;
    approvedPayoutTokens: number;
    paidPayoutTokens: number;
  };
  rows: FinanceRow[];
};

export default function AdminFinancePage() {
  const token = useAppSelector((s) => s.auth.token);
  const role = useAppSelector((s) => s.auth.user?.role);
  const [data, setData] = useState<FinanceSummary | null>(null);
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token || role !== "ADMIN") return;
    setLoading(true);
    setMsg(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const qs = params.toString();
      const res = await apiFetch(`/admin/finance/summary${qs ? `?${qs}` : ""}`);
      if (!res.ok) {
        setMsg(`Errore ${res.status}`);
        return;
      }
      setData((await res.json()) as FinanceSummary);
    } finally {
      setLoading(false);
    }
  }, [from, token, role, to]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!data || !q) return data?.rows ?? [];
    return data.rows.filter(
      (row) =>
        row.model.username.toLowerCase().includes(q) ||
        row.model.email.toLowerCase().includes(q),
    );
  }, [data, query]);

  function euro(tokens: number) {
    return data ? tokens * data.tokenEuroRate : 0;
  }

  function exportCsv() {
    if (!data) return;
    const header = [
      "modella",
      "email",
      "lordo_token",
      "netto_modella_token",
      "fee_piattaforma_token",
      "tasse_token",
      "netto_azienda_token",
      "da_pagare_token",
      "payout_pending_token",
      "payout_paid_token",
    ];
    const body = rows.map((row) => [
      row.model.username,
      row.model.email,
      row.grossTokens,
      row.creatorNetTokens,
      row.platformFeeTokens,
      row.taxIncludedTokens,
      row.platformNetTokens,
      row.availableForPayoutTokens,
      row.payouts.pending,
      row.payouts.paid,
    ]);
    const csv = [header, ...body]
      .map((line) =>
        line
          .map((cell) => `"${String(cell).replaceAll("\"", "\"\"")}"`)
          .join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finance-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!token) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-cam-text">
          <Link href="/login" className="font-semibold text-cam-orange-bright underline">
            Accedi
          </Link>{" "}
          come admin.
        </div>
      </AppShell>
    );
  }

  if (role !== "ADMIN") {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-cam-muted">
          Questa pagina è riservata agli amministratori.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-4 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-cam-orange-bright">
              Owner dashboard
            </p>
            <h1 className="mt-1 text-2xl font-black text-cam-text">
              Entrate, tasse e payout modelle
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-cam-muted">
              Riepilogo lordo per modella, quota piattaforma, quota tasse inclusa e netto disponibile per stipendi/payout.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/admin/payouts"
              className="rounded-full border border-cam-border px-4 py-2 text-xs font-bold text-cam-text hover:border-cam-orange"
            >
              Gestisci payout
            </Link>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="rounded-full bg-cam-cta px-4 py-2 text-xs font-black text-cam-ink disabled:opacity-60"
            >
              {loading ? "Aggiorno..." : "Aggiorna"}
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={!data}
              className="rounded-full border border-cam-border px-4 py-2 text-xs font-bold text-cam-text hover:border-cam-orange disabled:opacity-50"
            >
              Export CSV
            </button>
          </div>
        </div>

        {msg && (
          <p className="mt-4 rounded-md border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-sm text-amber-100">
            {msg}
          </p>
        )}

        {data && (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <Stat label="Incasso lordo" value={data.totals.grossTokens} euroValue={euro(data.totals.grossTokens)} />
              <Stat label="Netto modelle" value={data.totals.creatorNetTokens} euroValue={euro(data.totals.creatorNetTokens)} tone="green" />
              <Stat label="Quota piattaforma" value={data.totals.platformFeeTokens} euroValue={euro(data.totals.platformFeeTokens)} tone="orange" />
              <Stat label="Tasse incluse" value={data.totals.taxIncludedTokens} euroValue={euro(data.totals.taxIncludedTokens)} tone="red" />
              <Stat label="Netto azienda" value={data.totals.platformNetTokens} euroValue={euro(data.totals.platformNetTokens)} tone="blue" />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <MiniStat label="Disponibile da pagare" value={data.totals.availableForPayoutTokens} />
              <MiniStat label="Payout pending" value={data.totals.pendingPayoutTokens} />
              <MiniStat label="Payout pagati" value={data.totals.paidPayoutTokens} />
            </div>

            <div className="mt-4 rounded-md border border-cam-border bg-cam-ink p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <label className="text-xs font-semibold text-cam-muted">
                  Da
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-cam-border bg-cam-bg px-3 py-2 text-sm text-cam-text"
                  />
                </label>
                <label className="text-xs font-semibold text-cam-muted">
                  A
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-cam-border bg-cam-bg px-3 py-2 text-sm text-cam-text"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setFrom("");
                    setTo("");
                  }}
                  className="self-end rounded-full border border-cam-border px-4 py-2 text-xs font-bold text-cam-text hover:border-cam-orange"
                >
                  Reset date
                </button>
              </div>
              <p className="mt-3 text-xs text-cam-muted">
                Conversione: 1 token = €{data.tokenEuroRate.toFixed(4)} · configurabile con TOKEN_EUR_RATE.
                {" "}Payout modella: -{data.payoutWithholdPercent}% sul lordo euro.
              </p>
            </div>

            <div className="mt-6 rounded-md border border-cam-border bg-cam-card p-4 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-cam-text">Riepilogo per modella</h2>
                  <p className="text-xs text-cam-muted">
                    Commissione piattaforma {data.feePercent}% · tasse incluse stimate {data.taxPercent}% sulla quota piattaforma.
                  </p>
                </div>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cerca modella..."
                  className="rounded-full border border-cam-border bg-cam-ink px-3 py-2 text-sm text-cam-text outline-none focus:border-cam-orange"
                />
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-wide text-cam-muted">
                    <tr className="border-b border-cam-border">
                      <th className="py-2 pr-4">Modella</th>
                      <th className="py-2 pr-4">Lordo</th>
                      <th className="py-2 pr-4">Netto modella</th>
                      <th className="py-2 pr-4">Fee piattaforma</th>
                      <th className="py-2 pr-4">Tasse</th>
                      <th className="py-2 pr-4">Netto azienda</th>
                      <th className="py-2 pr-4">Da pagare</th>
                      <th className="py-2 pr-4">Fonti</th>
                      <th className="py-2 pr-4">Payout</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cam-border">
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-6 text-center text-cam-muted">
                          Nessuna modella trovata.
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => (
                        <tr key={row.model.id} className="text-cam-text">
                          <td className="py-3 pr-4">
                            <p className="font-bold">{row.model.username}</p>
                            <p className="text-[11px] text-cam-muted">{row.model.email}</p>
                          </td>
                          <MoneyCell value={row.grossTokens} />
                          <MoneyCell value={row.creatorNetTokens} tone="green" />
                          <MoneyCell value={row.platformFeeTokens} tone="orange" />
                          <MoneyCell value={row.taxIncludedTokens} tone="red" />
                          <MoneyCell value={row.platformNetTokens} tone="blue" />
                          <MoneyCell value={row.availableForPayoutTokens} tone="green" />
                          <td className="py-3 pr-4 text-xs text-cam-muted">
                            <p>Tip {formatInteger(row.sources.tips.amount)} tk</p>
                            <p>Show {formatInteger(row.sources.paidAccess.amount)} tk</p>
                            <p>Gallery {formatInteger(row.sources.gallery.amount)} tk</p>
                          </td>
                          <td className="py-3 pr-4 text-xs text-cam-muted">
                            {typeof row.availablePayoutEurNet === "number" && (
                              <p className="font-bold text-emerald-300">
                                Netto €{row.availablePayoutEurNet.toFixed(2)}
                              </p>
                            )}
                            {typeof row.availablePayoutWithholdEur === "number" && (
                              <p>Tratt. €{row.availablePayoutWithholdEur.toFixed(2)}</p>
                            )}
                            <p>Pending {formatInteger(row.payouts.pending)} tk</p>
                            <p>Approved {formatInteger(row.payouts.approved)} tk</p>
                            <p>Paid {formatInteger(row.payouts.paid)} tk</p>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  euroValue,
  tone = "default",
}: {
  label: string;
  value: number;
  euroValue?: number;
  tone?: "default" | "green" | "orange" | "red" | "blue";
}) {
  const color =
    tone === "green"
      ? "text-emerald-300"
      : tone === "orange"
        ? "text-cam-orange-bright"
        : tone === "red"
          ? "text-red-300"
          : tone === "blue"
            ? "text-sky-300"
            : "text-cam-text";
  return (
    <div className="rounded-md border border-cam-border bg-cam-card p-4 shadow-card">
      <p className="text-[11px] font-bold uppercase tracking-wide text-cam-muted">{label}</p>
      <p className={`mt-2 tabular-nums text-2xl font-black ${color}`}>
        {formatInteger(value)} tk
      </p>
      {typeof euroValue === "number" && (
        <p className="mt-1 text-xs text-cam-muted">≈ €{euroValue.toFixed(2)}</p>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-cam-border bg-cam-ink p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-cam-muted">{label}</p>
      <p className="mt-1 tabular-nums text-lg font-black text-cam-text">{formatInteger(value)} tk</p>
    </div>
  );
}

function MoneyCell({
  value,
  tone = "default",
}: {
  value: number;
  tone?: "default" | "green" | "orange" | "red" | "blue";
}) {
  const color =
    tone === "green"
      ? "text-emerald-300"
      : tone === "orange"
        ? "text-cam-orange-bright"
        : tone === "red"
          ? "text-red-300"
          : tone === "blue"
            ? "text-sky-300"
            : "text-cam-text";
  return (
    <td className={`py-3 pr-4 tabular-nums font-semibold ${color}`}>
      {formatInteger(value)} tk
    </td>
  );
}
