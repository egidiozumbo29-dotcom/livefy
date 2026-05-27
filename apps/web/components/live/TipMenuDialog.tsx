"use client";

import { Link } from "@/i18n/navigation";
import { useEffect, useState } from "react";
import { apiFetch, apiUrl } from "@/services/api";
import { dispatchBalanceSync } from "@/hooks/useBalanceSync";
import { useAppSelector } from "@/store/hooks";
import { formatInteger } from "@/lib/format";

type MenuItem = {
  id: string;
  label: string;
  tokenCost: number;
  sortOrder: number;
};

type Props = {
  open: boolean;
  creatorId: string;
  streamId?: string | null;
  onClose: () => void;
};

const QUICK_TIPS = [10, 25, 50, 100] as const;

export function TipMenuDialog({ open, creatorId, streamId, onClose }: Props) {
  const token = useAppSelector((s) => s.auth.token);
  const balance = useAppSelector((s) => s.auth.user?.balance ?? 0);
  const [menu, setMenu] = useState<MenuItem[] | null>(null);
  const [custom, setCustom] = useState<number>(20);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStatus(null);
    fetch(apiUrl(`/creators/menu/${encodeURIComponent(creatorId)}`))
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: MenuItem[]) => setMenu(rows))
      .catch(() => setMenu([]));
  }, [open, creatorId]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function send(amount: number, key: string, label?: string) {
    if (!token) {
      setStatus("Accedi per inviare mance.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setStatus("Importo non valido.");
      return;
    }
    setBusy(key);
    setStatus(null);
    try {
      const res = await apiFetch("/tips", {
        method: "POST",
        body: JSON.stringify({
          receiverId: creatorId,
          amount,
          streamId: streamId ?? undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(
          typeof body.message === "string"
            ? body.message
            : `Tip non riuscito (${res.status}).`,
        );
        return;
      }
      setStatus(
        label
          ? `Inviata: "${label}" (${formatInteger(amount)} tk).`
          : `Inviata: ${formatInteger(amount)} tk.`,
      );
      dispatchBalanceSync();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Tip menu"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-lg border border-cam-border bg-cam-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 bg-cam-cta px-4 py-3 text-cam-ink">
          <div>
            <h2 className="text-base font-bold">Manda una mancia</h2>
            <p className="text-[11px] opacity-90">
              Balance:{" "}
              <span className="tabular-nums font-bold">
                {token ? formatInteger(balance) : "—"}
              </span>{" "}
              tk
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-cam-ink/80 hover:bg-black/10 hover:text-cam-ink"
            aria-label="Chiudi"
          >
            ✕
          </button>
        </header>

        <div className="space-y-4 px-4 py-4">
          {!token && (
            <p className="rounded-md border border-cam-orange/35 bg-cam-orange/10 px-3 py-2 text-[11px] text-cam-text">
              <Link href="/login" className="font-bold text-cam-orange-bright underline">
                Accedi
              </Link>{" "}
              per inviare mance.
            </p>
          )}

          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-cam-muted">
              Tip menu della streamer
            </h3>
            {menu === null ? (
              <p className="mt-2 text-xs text-cam-muted">Carico…</p>
            ) : menu.length === 0 ? (
              <p className="mt-2 text-xs text-cam-muted">
                Nessuna voce nel menu. Usa una mancia rapida o personalizzata.
              </p>
            ) : (
              <ul className="mt-2 max-h-56 space-y-1.5 overflow-y-auto pr-1">
                {menu.map((it) => (
                  <li key={it.id}>
                    <button
                      type="button"
                      onClick={() =>
                        send(it.tokenCost, `menu-${it.id}`, it.label)
                      }
                      disabled={!!busy || !token}
                      className="flex w-full items-center justify-between gap-3 rounded-md border border-cam-border bg-cam-ink px-3 py-2 text-left text-sm text-cam-text transition hover:border-cam-orange hover:bg-cam-orange/10 disabled:opacity-50"
                    >
                      <span className="truncate">{it.label}</span>
                      <span className="shrink-0 rounded-full bg-cam-orange/20 px-2 py-0.5 text-[11px] font-bold tabular-nums text-cam-orange-bright">
                        {busy === `menu-${it.id}`
                          ? "..."
                          : `${formatInteger(it.tokenCost)} tk`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-cam-muted">
              Mancia rapida
            </h3>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {QUICK_TIPS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => send(amount, `quick-${amount}`)}
                  disabled={!!busy || !token}
                  className="rounded-md border border-cam-border bg-cam-ink px-2 py-2 text-sm font-bold tabular-nums text-cam-text transition hover:border-cam-orange hover:bg-cam-orange/10 disabled:opacity-50"
                >
                  {busy === `quick-${amount}` ? "..." : amount}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-cam-muted">
              Importo personalizzato
            </h3>
            <div className="mt-2 flex gap-2">
              <input
                type="number"
                min={1}
                max={500000}
                value={custom}
                onChange={(e) => setCustom(Number(e.target.value) || 0)}
                className="min-w-0 flex-1 rounded-md border border-cam-border bg-cam-ink px-3 py-2 text-sm text-cam-text focus:border-cam-orange focus:outline-none focus:ring-2 focus:ring-cam-orange/35"
              />
              <button
                type="button"
                onClick={() => send(custom, "custom")}
                disabled={!!busy || !token || custom <= 0}
                className="rounded-full bg-cam-cta px-4 py-2 text-xs font-bold uppercase tracking-wide text-cam-ink disabled:opacity-50"
              >
                {busy === "custom" ? "Invio…" : "Invia"}
              </button>
            </div>
          </section>

          {status && (
            <p
              className={`rounded-md px-3 py-2 text-xs ${
                status.startsWith("Inviata")
                  ? "bg-emerald-900/40 text-emerald-200"
                  : "bg-cam-ink text-cam-muted"
              }`}
              role="status"
            >
              {status}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
