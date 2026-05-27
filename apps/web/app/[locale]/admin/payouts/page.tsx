"use client";

import { Link } from "@/i18n/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { formatInteger } from "@/lib/format";
import { apiFetch } from "@/services/api";
import { useAppSelector } from "@/store/hooks";

type PayoutStatus = "PENDING" | "APPROVED" | "PAID" | "REJECTED";

type PayoutRow = {
  id: string;
  userId: string;
  user: { id: string; username: string; email: string };
  amount: number;
  amountEur?: number;
  amountEurGross?: number;
  withholdPercent?: number;
  withholdEur?: number;
  amountEurNet?: number;
  tokenEuroRate?: number;
  method: string;
  destination: string | null;
  status: PayoutStatus;
  note: string | null;
  createdAt: string;
  paidAt: string | null;
};

export default function AdminPayoutsPage() {
  const token = useAppSelector((s) => s.auth.token);
  const role = useAppSelector((s) => s.auth.user?.role);
  const [rows, setRows] = useState<PayoutRow[]>([]);
  const [filter, setFilter] = useState<PayoutStatus | "ALL">("PENDING");
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || role !== "ADMIN") return;
    const q =
      filter === "ALL" ? "" : `?status=${encodeURIComponent(filter)}`;
    const res = await apiFetch(`/admin/payouts${q}`);
    if (!res.ok) {
      setMsg(`Errore ${res.status}`);
      return;
    }
    setRows((await res.json()) as PayoutRow[]);
    setMsg(null);
  }, [token, role, filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function patchStatus(id: string, status: PayoutStatus) {
    setBusyId(id);
    setMsg(null);
    try {
      const res = await apiFetch(`/admin/payouts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setMsg(typeof b.message === "string" ? b.message : `Errore ${res.status}`);
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (!token) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-cam-text">
          <Link
            href="/login"
            className="font-semibold text-cam-orange-bright underline hover:text-cam-orange"
          >
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
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <h1 className="text-xl font-bold text-cam-text">Admin · Payout</h1>
        <p className="mt-1 text-sm text-cam-muted">
          Back-office proprietario: controlla richieste prelievo, conversione token/euro e stato pagamenti netti alle modelle.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {(["PENDING", "APPROVED", "PAID", "REJECTED", "ALL"] as const).map(
            (f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide transition ${
                  filter === f
                    ? "bg-cam-cta text-cam-ink"
                    : "border border-cam-border text-cam-muted hover:border-cam-orange hover:text-cam-orange-bright"
                }`}
              >
                {f}
              </button>
            ),
          )}
          <button
            type="button"
            onClick={() => load()}
            className="ml-auto rounded-full border border-cam-border px-3 py-1 text-xs font-semibold text-cam-text hover:border-cam-orange"
          >
            Aggiorna
          </button>
        </div>

        {msg && (
          <p className="mt-3 rounded-md border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-sm text-amber-100">
            {msg}
          </p>
        )}

        <ul className="mt-6 divide-y divide-cam-border overflow-hidden rounded-md border border-cam-border bg-cam-card shadow-[0_8px_28px_rgba(0,0,0,0.35)]">
          {rows.length === 0 ? (
            <li className="p-4 text-sm text-cam-muted">Nessuna richiesta.</li>
          ) : (
            rows.map((r) => (
              <li key={r.id} className="p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-cam-text">
                      {r.user.username}{" "}
                      <span className="font-normal text-cam-muted">
                        ({r.user.email})
                      </span>
                    </p>
                    <p className="tabular-nums text-cam-orange-bright">
                      {formatInteger(r.amount)} tk
                      {typeof r.amountEur === "number" && (
                        <> · lordo €{r.amountEur.toFixed(2)}</>
                      )}
                      {" "}· {r.method}
                    </p>
                    {typeof r.amountEurNet === "number" && (
                      <p className="text-sm font-bold text-emerald-300">
                        Netto da pagare: €{r.amountEurNet.toFixed(2)}
                        {typeof r.withholdPercent === "number" && (
                          <> · trattenuta {r.withholdPercent}%</>
                        )}
                      </p>
                    )}
                    {typeof r.withholdEur === "number" && (
                      <p className="text-[11px] text-cam-muted">
                        Trattenuto: €{r.withholdEur.toFixed(2)}
                      </p>
                    )}
                    {typeof r.tokenEuroRate === "number" && (
                      <p className="text-[11px] text-cam-muted">
                        Cambio applicato: 1 token = €{r.tokenEuroRate.toFixed(4)}
                      </p>
                    )}
                    {r.destination && (
                      <p className="text-xs text-cam-muted">{r.destination}</p>
                    )}
                    <p className="text-[11px] text-cam-muted">
                      {r.status} · {new Date(r.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {r.status === "PENDING" && (
                      <>
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => patchStatus(r.id, "APPROVED")}
                          className="rounded-full bg-blue-600 px-2 py-1 text-[11px] font-bold text-white disabled:opacity-50"
                        >
                          Approva
                        </button>
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => patchStatus(r.id, "PAID")}
                          className="rounded-full bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white disabled:opacity-50"
                        >
                          Pagata
                        </button>
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => patchStatus(r.id, "REJECTED")}
                          className="rounded-full bg-red-600 px-2 py-1 text-[11px] font-bold text-white disabled:opacity-50"
                        >
                          Rifiuta
                        </button>
                      </>
                    )}
                    {r.status === "APPROVED" && (
                      <>
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => patchStatus(r.id, "PAID")}
                          className="rounded-full bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white disabled:opacity-50"
                        >
                          Pagata
                        </button>
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => patchStatus(r.id, "REJECTED")}
                          className="rounded-full bg-red-600 px-2 py-1 text-[11px] font-bold text-white disabled:opacity-50"
                        >
                          Rifiuta
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </AppShell>
  );
}
