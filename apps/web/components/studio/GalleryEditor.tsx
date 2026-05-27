"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/services/api";

type GalleryKind = "PHOTO" | "VIDEO";

type Row = {
  id?: string;
  kind: GalleryKind;
  title: string;
  mediaUrl: string;
  thumbnailUrl: string;
  tokenPrice: number;
  published: boolean;
  sortOrder: number;
};

export function GalleryEditor() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiFetch("/creators/me/gallery")
      .then((r) => {
        if (r.status === 403 || r.status === 401) {
          setMsg("Non autorizzato.");
          return [];
        }
        if (!r.ok) return [];
        return r.json() as Promise<
          Array<{
            id: string;
            kind: GalleryKind;
            title: string;
            mediaUrl: string;
            thumbnailUrl: string | null;
            tokenPrice: number;
            published: boolean;
            sortOrder: number;
          }>
        >;
      })
      .then((rows) =>
        setItems(
          rows.map((r, i) => ({
            id: r.id,
            kind: r.kind,
            title: r.title ?? "",
            mediaUrl: r.mediaUrl,
            thumbnailUrl: r.thumbnailUrl ?? "",
            tokenPrice: r.tokenPrice,
            published: r.published,
            sortOrder: r.sortOrder ?? i,
          })),
        ),
      )
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  function update(idx: number, patch: Partial<Row>) {
    setItems((rows) => {
      const next = [...rows];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }

  function add(kind: GalleryKind) {
    setItems((rows) => [
      ...rows,
      {
        kind,
        title: "",
        mediaUrl: "",
        thumbnailUrl: "",
        tokenPrice: 0,
        published: true,
        sortOrder: rows.length,
      },
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
          .filter((r) => r.mediaUrl.trim())
          .map((r, i) => ({
            kind: r.kind,
            title: r.title.trim().slice(0, 200),
            mediaUrl: r.mediaUrl.trim().slice(0, 2048),
            thumbnailUrl: r.thumbnailUrl.trim()
              ? r.thumbnailUrl.trim().slice(0, 2048)
              : null,
            tokenPrice: Math.max(0, Math.floor(r.tokenPrice)),
            published: r.published,
            sortOrder: r.sortOrder ?? i,
          })),
      };
      const res = await apiFetch("/creators/me/gallery", {
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
      const rows = (await res.json()) as Array<{
        id: string;
        kind: GalleryKind;
        title: string;
        mediaUrl: string;
        thumbnailUrl: string | null;
        tokenPrice: number;
        published: boolean;
        sortOrder: number;
      }>;
      setItems(
        rows.map((r, i) => ({
          id: r.id,
          kind: r.kind,
          title: r.title ?? "",
          mediaUrl: r.mediaUrl,
          thumbnailUrl: r.thumbnailUrl ?? "",
          tokenPrice: r.tokenPrice,
          published: r.published,
          sortOrder: r.sortOrder ?? i,
        })),
      );
      setMsg("Galleria salvata.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel-card">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-cam-text">
            Galleria foto / video
          </h2>
          <p className="text-xs text-cam-muted">
            Incolla URL pubblici (CDN). Per contenuti a pagamento imposta un
            prezzo in token e opzionalmente un&apos;immagine teaser (thumbnail).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => add("PHOTO")}
            className="rounded-full border border-cam-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-cam-muted hover:border-cam-orange hover:text-cam-orange-bright"
          >
            + Foto
          </button>
          <button
            type="button"
            onClick={() => add("VIDEO")}
            className="rounded-full border border-cam-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-cam-muted hover:border-cam-orange hover:text-cam-orange-bright"
          >
            + Video
          </button>
        </div>
      </header>

      {loading ? (
        <p className="mt-6 text-sm text-cam-muted">Carico...</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.length === 0 && (
            <li className="rounded-md border border-dashed border-cam-border px-4 py-6 text-center text-xs text-cam-muted">
              Nessun elemento. Aggiungi foto o video per la tua vetrina.
            </li>
          )}
          {items.map((row, idx) => (
            <li
              key={row.id ?? `new-${idx}`}
              className="rounded-md border border-cam-border bg-cam-ink p-4"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-cam-orange-bright">
                  {row.kind === "PHOTO" ? "Foto" : "Video"}
                </span>
                <label className="ml-auto flex items-center gap-1.5 text-[11px] text-cam-muted">
                  <input
                    type="checkbox"
                    checked={row.published}
                    onChange={(e) =>
                      update(idx, { published: e.target.checked })
                    }
                    className="rounded border-cam-border bg-cam-bg text-cam-orange-bright accent-cam-orange"
                  />
                  Pubblicato
                </label>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-[11px] font-semibold text-cam-muted">
                  Titolo
                  <input
                    type="text"
                    value={row.title}
                    onChange={(e) => update(idx, { title: e.target.value })}
                    className="form-input"
                  />
                </label>
                <label className="block text-[11px] font-semibold text-cam-muted">
                  Prezzo (token, 0 = gratis)
                  <input
                    type="number"
                    min={0}
                    max={500000}
                    value={row.tokenPrice}
                    onChange={(e) =>
                      update(idx, {
                        tokenPrice: Math.max(
                          0,
                          Number(e.target.value) || 0,
                        ),
                      })
                    }
                    className="form-input tabular-nums"
                  />
                </label>
              </div>
              <label className="mt-3 block text-[11px] font-semibold text-cam-muted">
                URL media
                <input
                  type="url"
                  value={row.mediaUrl}
                  onChange={(e) => update(idx, { mediaUrl: e.target.value })}
                  placeholder="https://..."
                  className="form-input"
                />
              </label>
              <label className="mt-2 block text-[11px] font-semibold text-cam-muted">
                URL thumbnail teaser (facoltativo, consigliato se a pagamento)
                <input
                  type="url"
                  value={row.thumbnailUrl}
                  onChange={(e) =>
                    update(idx, { thumbnailUrl: e.target.value })
                  }
                  placeholder="https://..."
                  className="form-input"
                />
              </label>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="rounded-full border border-cam-border px-3 py-1.5 text-xs font-semibold text-cam-muted hover:border-red-500/50 hover:text-red-400"
                >
                  Rimuovi
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {msg && <p className="panel-muted mt-3">{msg}</p>}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-full bg-cam-cta px-4 py-2 text-sm font-bold uppercase tracking-wide text-cam-ink shadow disabled:opacity-50"
        >
          {saving ? "Salvo..." : "Salva galleria"}
        </button>
      </div>
    </section>
  );
}
