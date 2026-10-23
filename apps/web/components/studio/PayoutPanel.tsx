"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/services/api";
import { formatInteger } from "@/lib/format";

type PayoutStatus = "PENDING" | "APPROVED" | "PAID" | "REJECTED";

type PayoutRow = {
  id: string;
  amount: number;
  method: string;
  destination: string | null;
  status: PayoutStatus;
  note: string | null;
  createdAt: string;
  paidAt: string | null;
};

type StatusInfo = {
  tokenBalance: number;
  creatorBalance: number;
  pending: number;
  totalPaid: number;
  minPayout: number;
};

const METHODS = [
  { value: "bank", label: "Bonifico bancario (IBAN)" },
  { value: "paypal", label: "PayPal" },
  { value: "crypto", label: "Crypto (USDT / BTC / ETH)" },
  { value: "manual", label: "Altro (concordato manualmente)" },
];

function statusBadge(status: PayoutStatus) {
  switch (status) {
    case "PENDING":
      return "bg-amber-900/40 text-amber-200 border-amber-600/40";
    case "APPROVED":
      return "bg-blue-900/40 text-blue-200 border-blue-600/40";
    case "PAID":
      return "bg-emerald-900/40 text-emerald-200 border-emerald-600/40";
    case "REJECTED":
      return "bg-red-900/40 text-red-200 border-red-600/40";
  }
}

function statusLabel(status: PayoutStatus) {
  switch (status) {
    case "PENDING":
      return "In attesa";
    case "APPROVED":
      return "Approvata";
    case "PAID":
      return "Pagata";
    case "REJECTED":
      return "Rifiutata";
  }
}

export function PayoutPanel() {
  const [info, setInfo] = useState<StatusInfo | null>(null);
  const [rows, setRows] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState<string>("bank");
  const [destination, setDestination] = useState("");
  const [note, setNote] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const [s, l] = await Promise.all([
        apiFetch("/payouts/me/status"),
        apiFetch("/payouts/me"),
      ]);
      if (s.ok) {
        const data = (await s.json()) as StatusInfo;
        setInfo(data);
        if (!amount) {
          setAmount(
            data.creatorBalance >= data.minPayout
              ? data.minPayout
              : Math.floor(data.creatorBalance),
          );
        }
      }
      if (l.ok) {
        const data = (await l.json()) as PayoutRow[];
        setRows(data);
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const canRequest = useMemo(() => {
    if (!info) return false;
    if (amount <= 0) return false;
    if (amount < info.minPayout && info.creatorBalance >= info.minPayout) {
      return false;
    }
    if (amount > info.creatorBalance) return false;
    return true;
  }, [info, amount]);

  async function handleRequest() {
    if (!info) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await apiFetch("/payouts", {
        method: "POST",
        body: JSON.stringify({
          amount: Math.floor(amount),
          method,
          destination: destination.trim() || undefined,
          note: note.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setMsg(
          typeof body?.message === "string"
            ? messageFor(res.status, body.message, info.minPayout)
            : `Errore ${res.status}`,
        );
        return;
      }
      setMsg("Richiesta di payout inviata.");
      setDestination("");
      setNote("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleExportCsv() {
    try {
      const res = await apiFetch("/payouts/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payouts_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setMsg("Errore durante l'export CSV.");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-cam-border bg-cam-card p-5 shadow-card">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-cam-muted">
              Wallet creator
            </p>
            <h2 className="text-xl font-bold text-cam-text">Payout</h2>
            <p className="mt-1 text-xs text-cam-muted">
              I tuoi guadagni netti vengono accumulati qui (al netto della fee
              della piattaforma) e possono essere prelevati.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={loading}
              className="rounded-full border border-cam-border px-3 py-1.5 text-xs font-semibold text-cam-muted hover:border-cam-orange hover:text-cam-orange-bright disabled:opacity-50"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="rounded-full border border-cam-border px-3 py-1.5 text-xs font-semibold text-cam-muted hover:border-cam-orange hover:text-cam-orange-bright disabled:opacity-50"
            >
              {loading ? "..." : "Aggiorna"}
            </button>
          </div>
        </header>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-emerald-500/35 bg-emerald-950/35 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-300">
              Disponibile
            </p>
            <p className="mt-1 text-2xl font-bold text-emerald-100 tabular-nums">
              {info ? formatInteger(info.creatorBalance) : "..."}
              <span className="ml-1 text-xs font-semibold text-emerald-300">
                tk
              </span>
            </p>
          </div>
          <div className="rounded-md border border-amber-500/35 bg-amber-950/35 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-300">
              In elaborazione
            </p>
            <p className="mt-1 text-2xl font-bold text-amber-100 tabular-nums">
              {info ? formatInteger(info.pending) : "..."}
              <span className="ml-1 text-xs font-semibold text-amber-300">
                tk
              </span>
            </p>
          </div>
          <div className="rounded-md border border-blue-500/35 bg-slate-950/50 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-blue-300">
              Totale prelevato
            </p>
            <p className="mt-1 text-2xl font-bold text-blue-100 tabular-nums">
              {info ? formatInteger(info.totalPaid) : "..."}
              <span className="ml-1 text-xs font-semibold text-blue-300">
                tk
              </span>
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-md border border-cam-border bg-cam-card p-5 shadow-card">
        <h3 className="text-sm font-bold uppercase tracking-wider text-cam-text">
          Richiedi payout
        </h3>
        <p className="mt-1 text-xs text-cam-muted">
          Minimo per richiesta:{" "}
          <strong className="text-cam-text">
            {info ? formatInteger(info.minPayout) : "..."}
          </strong>{" "}
          token. Se il saldo disponibile è inferiore al minimo, puoi richiedere
          tutto il saldo disponibile.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-cam-muted">
            Importo (token)
            <input
              type="number"
              min={
                info
                  ? info.creatorBalance >= info.minPayout
                    ? info.minPayout
                    : 1
                  : 0
              }
              max={info?.creatorBalance ?? 0}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-md border border-cam-border bg-cam-ink px-3 py-2 text-sm text-cam-text focus:border-cam-orange focus:outline-none focus:ring-2 focus:ring-cam-orange/35"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wider text-cam-muted">
            Metodo
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="mt-1 w-full rounded-md border border-cam-border bg-cam-ink px-3 py-2 text-sm text-cam-text focus:border-cam-orange focus:outline-none focus:ring-2 focus:ring-cam-orange/35"
            >
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-3 block text-xs font-semibold uppercase tracking-wider text-cam-muted">
          Destinazione (IBAN, email PayPal, indirizzo crypto, ecc.)
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            maxLength={512}
            placeholder="Es. IT60X0542811101000000123456"
            className="mt-1 w-full rounded-md border border-cam-border bg-cam-ink px-3 py-2 text-sm text-cam-text focus:border-cam-orange focus:outline-none focus:ring-2 focus:ring-cam-orange/35"
          />
        </label>

        <label className="mt-3 block text-xs font-semibold uppercase tracking-wider text-cam-muted">
          Note (opzionale)
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={2000}
            rows={2}
            className="mt-1 w-full rounded-md border border-cam-border bg-cam-ink px-3 py-2 text-sm text-cam-text focus:border-cam-orange focus:outline-none focus:ring-2 focus:ring-cam-orange/35"
          />
        </label>

        {msg && (
          <p
            className={`mt-3 rounded-md px-3 py-2 text-xs ${
              msg.startsWith("Richiesta")
                ? "border border-emerald-500/30 bg-emerald-950/35 text-emerald-100"
                : "border border-amber-500/30 bg-amber-950/35 text-amber-100"
            }`}
          >
            {msg}
          </p>
        )}

        <button
          type="button"
          disabled={busy || !canRequest}
          onClick={handleRequest}
          className="mt-4 rounded-full bg-cam-cta px-5 py-2 text-xs font-bold uppercase tracking-wide text-cam-ink shadow disabled:opacity-50"
        >
          {busy ? "Invio..." : "Richiedi prelievo"}
        </button>
      </section>

      <section className="rounded-md border border-cam-border bg-cam-card p-5 shadow-card">
        <h3 className="text-sm font-bold uppercase tracking-wider text-cam-text">
          Storico richieste
        </h3>
        {rows.length === 0 ? (
          <p className="mt-3 text-xs text-cam-muted">
            Nessuna richiesta finora.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-cam-border">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div>
                  <p className="text-sm font-bold text-cam-text tabular-nums">
                    {formatInteger(r.amount)} tk
                  </p>
                  <p className="text-[11px] text-cam-muted">
                    {r.method} · {new Date(r.createdAt).toLocaleString()}
                  </p>
                  {r.destination && (
                    <p className="mt-0.5 text-[11px] text-cam-muted">
                      → {r.destination}
                    </p>
                  )}
                </div>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${statusBadge(r.status)}`}
                >
                  {statusLabel(r.status)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function messageFor(status: number, message: string, minPayout: number) {
  if (status === 402) return "Saldo creator insufficiente per questo importo.";
  if (message === "amount_below_min") {
    return `Importo minimo: ${formatInteger(minPayout)} token.`;
  }
  if (message === "creator_balance_insufficiente") {
    return "Saldo creator insufficiente.";
  }
  return message;
}
