"use client";

import { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/services/api";
import { useAppSelector } from "@/store/hooks";

type VerificationStatus = "PENDING" | "APPROVED" | "REJECTED";

type VerificationRow = {
  id: string;
  userId: string;
  user: { id: string; username: string; email: string; avatarUrl: string | null };
  status: VerificationStatus;
  realName: string | null;
  realAddress: string | null;
  phoneNumber: string | null;
  taxId: string | null;
  createdAt: string;
  rejectionReason: string | null;
};

export default function AdminVerificationsPage() {
  const token = useAppSelector((s) => s.auth.token);
  const role = useAppSelector((s) => s.auth.user?.role);
  const [rows, setRows] = useState<VerificationRow[]>([]);
  const [filter, setFilter] = useState<VerificationStatus | "ALL">("PENDING");
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ id: string; reason: string } | null>(null);

  const load = useCallback(async () => {
    if (!token || role !== "ADMIN") return;
    const q =
      filter === "ALL" ? "" : `?status=${encodeURIComponent(filter)}`;
    const res = await apiFetch(`/verifications/pending${q}`);
    if (!res.ok) {
      setMsg(`Errore ${res.status}`);
      return;
    }
    setRows((await res.json()) as VerificationRow[]);
    setMsg(null);
  }, [token, role, filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleApprove(id: string) {
    setBusyId(id);
    try {
      const res = await apiFetch(`/verifications/${id}/approve`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Approvazione fallita");
      setMsg("Creator approvato con successo");
      await load();
    } catch (err) {
      setMsg("Errore durante l'approvazione");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject() {
    if (!rejectDialog) return;
    setBusyId(rejectDialog.id);
    try {
      const res = await apiFetch(`/verifications/${rejectDialog.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: rejectDialog.reason }),
      });
      if (!res.ok) throw new Error("Rifiuto fallito");
      setMsg("Creator rifiutato");
      setRejectDialog(null);
      await load();
    } catch (err) {
      setMsg("Errore durante il rifiuto");
    } finally {
      setBusyId(null);
    }
  }

  if (!token || role !== "ADMIN") {
    return (
      <AppShell>
        <div className="rounded-md border border-red-500/30 bg-red-950/35 px-4 py-4 text-sm text-red-200">
          Accesso negato. Solo admin possono accedere a questa pagina.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-cam-text">
              Approvazione Creator
            </h1>
            <p className="mt-1 text-sm text-cam-muted">
              Gestisci le richieste di verifica per diventare creator
            </p>
          </div>
          <div className="flex gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as VerificationStatus | "ALL")}
              className="rounded-md border border-cam-border bg-cam-ink px-3 py-2 text-sm text-cam-text focus:border-cam-orange focus:outline-none"
            >
              <option value="ALL">Tutte</option>
              <option value="PENDING">In attesa</option>
              <option value="APPROVED">Approvate</option>
              <option value="REJECTED">Rifiutate</option>
            </select>
            <button
              onClick={load}
              className="rounded-full border border-cam-border px-3 py-1.5 text-xs font-semibold text-cam-muted hover:border-cam-orange hover:text-cam-orange-bright"
            >
              Aggiorna
            </button>
          </div>
        </header>

        {msg && (
          <div
            className={`rounded-md px-3 py-2 text-xs ${
              msg.includes("success")
                ? "border border-emerald-500/30 bg-emerald-950/35 text-emerald-100"
                : "border border-amber-500/30 bg-amber-950/35 text-amber-100"
            }`}
          >
            {msg}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="rounded-md border border-cam-border bg-cam-card px-4 py-8 text-center text-sm text-cam-muted">
            Nessuna richiesta di verifica trovata.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div
                key={row.id}
                className="rounded-md border border-cam-border bg-cam-card p-4 shadow-card"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    {row.user.avatarUrl && (
                      <img
                        src={row.user.avatarUrl}
                        alt={row.user.username}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    )}
                    <div>
                      <p className="font-bold text-cam-text">
                        {row.user.username}
                      </p>
                      <p className="text-xs text-cam-muted">{row.user.email}</p>
                      <p className="mt-1 text-xs text-cam-muted">
                        Richiesto: {new Date(row.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                      row.status === "PENDING"
                        ? "border-amber-500/40 bg-amber-950/35 text-amber-200"
                        : row.status === "APPROVED"
                          ? "border-emerald-500/40 bg-emerald-950/35 text-emerald-200"
                          : "border-red-500/40 bg-red-950/35 text-red-200"
                    }`}
                  >
                    {row.status === "PENDING"
                      ? "In attesa"
                      : row.status === "APPROVED"
                        ? "Approvato"
                        : "Rifiutato"}
                  </span>
                </div>

                {(row.realName || row.realAddress || row.phoneNumber || row.taxId) && (
                  <div className="mt-3 grid gap-2 text-xs text-cam-muted sm:grid-cols-2">
                    {row.realName && (
                      <div>
                        <span className="font-semibold text-cam-text">Nome:</span>{" "}
                        {row.realName}
                      </div>
                    )}
                    {row.phoneNumber && (
                      <div>
                        <span className="font-semibold text-cam-text">Telefono:</span>{" "}
                        {row.phoneNumber}
                      </div>
                    )}
                    {row.realAddress && (
                      <div className="sm:col-span-2">
                        <span className="font-semibold text-cam-text">Indirizzo:</span>{" "}
                        {row.realAddress}
                      </div>
                    )}
                    {row.taxId && (
                      <div>
                        <span className="font-semibold text-cam-text">Codice fiscale/VAT:</span>{" "}
                        {row.taxId}
                      </div>
                    )}
                  </div>
                )}

                {row.rejectionReason && (
                  <div className="mt-3 rounded-md border border-red-500/30 bg-red-950/35 px-3 py-2 text-xs text-red-200">
                    <span className="font-bold">Motivo rifiuto:</span> {row.rejectionReason}
                  </div>
                )}

                {row.status === "PENDING" && (
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => handleApprove(row.id)}
                      disabled={busyId === row.id}
                      className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white shadow disabled:opacity-50"
                    >
                      {busyId === row.id ? "..." : "Approva"}
                    </button>
                    <button
                      onClick={() => setRejectDialog({ id: row.id, reason: "" })}
                      disabled={busyId === row.id}
                      className="rounded-full border border-red-500/50 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      Rifiuta
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {rejectDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-w-md w-full rounded-md border border-cam-border bg-cam-card p-6 shadow-card">
              <h3 className="text-lg font-bold text-cam-text">
                Rifiuta richiesta
              </h3>
              <p className="mt-2 text-sm text-cam-muted">
                Inserisci il motivo del rifiuto:
              </p>
              <textarea
                value={rejectDialog.reason}
                onChange={(e) =>
                  setRejectDialog({ ...rejectDialog, reason: e.target.value })
                }
                rows={3}
                className="mt-3 w-full rounded-md border border-cam-border bg-cam-ink px-3 py-2 text-sm text-cam-text focus:border-cam-orange focus:outline-none focus:ring-2 focus:ring-cam-orange/35"
              />
              <div className="mt-4 flex gap-2 justify-end">
                <button
                  onClick={() => setRejectDialog(null)}
                  className="rounded-full border border-cam-border px-4 py-1.5 text-xs font-semibold text-cam-muted hover:border-cam-orange hover:text-cam-orange-bright"
                >
                  Annulla
                </button>
                <button
                  onClick={handleReject}
                  disabled={!rejectDialog.reason.trim()}
                  className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white shadow disabled:opacity-50"
                >
                  Conferma rifiuto
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
