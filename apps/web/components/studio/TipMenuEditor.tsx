"use client";

import { useEffect, useState } from "react";
import { apiFetch, apiUrl } from "@/services/api";

type Item = {
  id?: string;
  label: string;
  tokenCost: number;
  sortOrder: number;
};

export function TipMenuEditor({ userId }: { userId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetch(apiUrl(`/creators/menu/${encodeURIComponent(userId)}`))
      .then((r) => r.json())
      .then((rows: Item[]) =>
        setItems(
          rows
            .map((r, i) => ({
              id: r.id,
              label: r.label,
              tokenCost: r.tokenCost,
              sortOrder: r.sortOrder ?? i,
            }))
            .sort((a, b) => a.sortOrder - b.sortOrder),
        ),
      )
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [userId]);

  function update(idx: number, patch: Partial<Item>) {
    setItems((rows) => {
      const next = [...rows];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }

  function add() {
    setItems((rows) => [
      ...rows,
      { label: "", tokenCost: 10, sortOrder: rows.length },
    ]);
  }

  function remove(idx: number) {
    setItems((rows) => rows.filter((_, i) => i !== idx));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const payload = {
        items: items
          .filter((r) => r.label.trim() && r.tokenCost > 0)
          .map((r, i) => ({
            label: r.label.trim().slice(0, 120),
            tokenCost: Math.max(1, Math.floor(r.tokenCost)),
            sortOrder: r.sortOrder ?? i,
          })),
      };
      const res = await apiFetch("/creators/me/tip-menu", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setMsg(
          typeof body.message === "string"
            ? body.message
            : "Salvataggio non riuscito.",
        );
        return;
      }
      const rows = (await res.json()) as Item[];
      setItems(
        rows
          .map((r, i) => ({
            id: r.id,
            label: r.label,
            tokenCost: r.tokenCost,
            sortOrder: r.sortOrder ?? i,
          }))
          .sort((a, b) => a.sortOrder - b.sortOrder),
      );
      setMsg("Tip menu salvato.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel-card">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-cam-text">Tip menu</h2>
          <p className="text-xs text-cam-muted">
            Le voci appaiono nella chat live (bottone Tip) e nel profilo.
          </p>
        </div>
        <button
          type="button"
          onClick={add}
          className="rounded-full border border-cam-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-cam-muted hover:border-cam-orange hover:text-cam-orange-bright"
        >
          + Voce
        </button>
      </header>

      {loading ? (
        <p className="mt-6 text-sm text-cam-muted">Carico...</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.length === 0 && (
            <li className="rounded-md border border-dashed border-cam-border px-4 py-6 text-center text-xs text-cam-muted">
              Nessuna voce. Aggiungine almeno una per il tuo tip menu.
            </li>
          )}
          {items.map((row, idx) => (
            <li
              key={row.id ?? `new-${idx}`}
              className="grid grid-cols-[1fr_120px_auto] items-center gap-2 rounded-md border border-cam-border bg-cam-ink px-3 py-2"
            >
              <input
                type="text"
                value={row.label}
                onChange={(e) => update(idx, { label: e.target.value })}
                placeholder="Es. Bacio, Spogliarello..."
                className="rounded-md border border-cam-border bg-cam-bg px-3 py-1.5 text-sm text-cam-text placeholder:text-cam-muted focus:border-cam-orange focus:outline-none focus:ring-2 focus:ring-cam-orange/35"
              />
              <input
                type="number"
                min={1}
                max={500000}
                value={row.tokenCost}
                onChange={(e) =>
                  update(idx, { tokenCost: Number(e.target.value) || 0 })
                }
                className="rounded-md border border-cam-border bg-cam-bg px-3 py-1.5 text-sm tabular-nums text-cam-text focus:border-cam-orange focus:outline-none focus:ring-2 focus:ring-cam-orange/35"
              />
              <button
                type="button"
                onClick={() => remove(idx)}
                aria-label="Rimuovi voce"
                className="rounded-full border border-cam-border px-3 py-1.5 text-xs font-semibold text-cam-muted hover:border-red-500/50 hover:text-red-400"
              >
                Rimuovi
              </button>
            </li>
          ))}
        </ul>
      )}

      {msg && (
        <p className="panel-muted mt-3">
          {msg}
        </p>
      )}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-full bg-cam-cta px-4 py-2 text-sm font-bold uppercase tracking-wide text-cam-ink shadow disabled:opacity-50"
        >
          {saving ? "Salvo..." : "Salva tip menu"}
        </button>
      </div>
    </section>
  );
}
