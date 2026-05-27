"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { apiFetch } from "@/services/api";
import { formatIsoUtc } from "@/lib/format";

type UserLite = { id: string; username: string; email?: string; role?: string };

type ModerationDashboard = {
  live: {
    id: string;
    title: string;
    viewers: number;
    chatOpen: boolean;
    showMode: string;
    startedAt: string | null;
  } | null;
  moderators: { id: string; createdAt: string; user: UserLite }[];
  wordFilters: { id: string; phrase: string; createdAt: string }[];
  actions: {
    id: string;
    type: "MUTE" | "BAN";
    reason: string | null;
    createdAt: string;
    expiresAt: string | null;
    target: UserLite;
    actor: UserLite;
  }[];
  reports: {
    id: string;
    reason: string;
    details: string | null;
    status: "OPEN" | "REVIEWING" | "RESOLVED" | "REJECTED";
    createdAt: string;
    reporter: UserLite;
    target: UserLite | null;
    stream: { id: string; title: string; status: string } | null;
  }[];
};

export function ModerationPanel() {
  const [data, setData] = useState<ModerationDashboard | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [moderatorUsername, setModeratorUsername] = useState("");
  const [word, setWord] = useState("");
  const [search, setSearch] = useState("");
  const [targets, setTargets] = useState<UserLite[]>([]);
  const [targetId, setTargetId] = useState("");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState(10);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/moderation/me");
      if (!res.ok) {
        setMsg(`Errore ${res.status}`);
        return;
      }
      setData((await res.json()) as ModerationDashboard);
      setMsg(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setTargets([]);
      return;
    }
    const id = window.setTimeout(async () => {
      const res = await apiFetch(`/users/search?q=${encodeURIComponent(q)}&take=8`);
      if (!res.ok) return;
      const body = (await res.json()) as { items?: UserLite[] };
      setTargets(body.items ?? []);
    }, 250);
    return () => window.clearTimeout(id);
  }, [search]);

  async function post(path: string, body?: unknown) {
    setMsg(null);
    const res = await apiFetch(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setMsg(typeof b.message === "string" ? b.message : `Errore ${res.status}`);
      return false;
    }
    await refresh();
    return true;
  }

  async function del(path: string) {
    const res = await apiFetch(path, { method: "DELETE" });
    if (!res.ok) {
      setMsg(`Errore ${res.status}`);
      return;
    }
    await refresh();
  }

  async function patchReport(id: string, status: string) {
    const res = await apiFetch(`/moderation/reports/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      setMsg(`Errore ${res.status}`);
      return;
    }
    await refresh();
  }

  return (
    <div className="space-y-6">
      <header className="rounded-md border border-cam-border bg-cam-card p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-cam-orange-bright">
              Moderazione
            </p>
            <h2 className="mt-1 text-xl font-bold text-cam-text">
              Moderatori, utenti, parole e report
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-cam-muted">
              Gestisci la sicurezza della room: mute/ban, filtri parole,
              segnalazioni e controllo rapido della live.
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
        {msg && (
          <p className="mt-4 rounded-md border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-sm text-amber-100">
            {msg}
          </p>
        )}
      </header>

      <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-md border border-cam-border bg-cam-card p-5 shadow-card">
          <SectionTitle title="Controllo livestream" />
          {data?.live ? (
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-md border border-cam-border bg-cam-ink p-3">
                <p className="font-bold text-cam-text">{data.live.title || "Live senza titolo"}</p>
                <p className="text-xs text-cam-muted">
                  {data.live.viewers} viewer · {data.live.showMode} · chat{" "}
                  {data.live.chatOpen ? "aperta" : "chiusa"}
                </p>
                {data.live.startedAt && (
                  <p className="mt-1 text-[11px] text-cam-muted">
                    Start: {formatIsoUtc(data.live.startedAt)}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => post(`/moderation/streams/${data.live!.id}/control`, { action: data.live!.chatOpen ? "CLOSE_CHAT" : "OPEN_CHAT" })}
                  className="rounded-full border border-cam-border px-3 py-1.5 text-xs font-bold text-cam-text hover:border-cam-orange"
                >
                  {data.live.chatOpen ? "Chiudi chat" : "Apri chat"}
                </button>
                <button
                  type="button"
                  onClick={() => confirm("Terminare la live?") && post(`/moderation/streams/${data.live!.id}/control`, { action: "END_STREAM" })}
                  className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white"
                >
                  Termina live
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-cam-muted">Nessuna live attiva.</p>
          )}
        </div>

        <div className="rounded-md border border-cam-border bg-cam-card p-5 shadow-card">
          <SectionTitle title="Mute / Ban utenti" />
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_160px]">
            <label className="text-xs font-semibold text-cam-muted">
              Cerca username
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mt-1 w-full rounded-md border border-cam-border bg-cam-ink px-3 py-2 text-sm text-cam-text outline-none focus:border-cam-orange"
                placeholder="username"
              />
            </label>
            <label className="text-xs font-semibold text-cam-muted">
              Durata mute (min)
              <input
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                type="number"
                min={1}
                className="mt-1 w-full rounded-md border border-cam-border bg-cam-ink px-3 py-2 text-sm text-cam-text outline-none focus:border-cam-orange"
              />
            </label>
          </div>
          {targets.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {targets.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setTargetId(u.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    targetId === u.id
                      ? "border-cam-orange bg-cam-orange/15 text-cam-orange-bright"
                      : "border-cam-border text-cam-muted"
                  }`}
                >
                  @{u.username}
                </button>
              ))}
            </div>
          )}
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="mt-3 w-full rounded-md border border-cam-border bg-cam-ink px-3 py-2 text-sm text-cam-text outline-none focus:border-cam-orange"
            placeholder="Motivo opzionale"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!targetId}
              onClick={() => post(`/moderation/users/${targetId}/mute`, { durationMinutes: duration, reason })}
              className="rounded-full bg-amber-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              Mute
            </button>
            <button
              type="button"
              disabled={!targetId}
              onClick={() => post(`/moderation/users/${targetId}/ban`, { reason })}
              className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              Ban
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-cam-border bg-cam-card p-5 shadow-card">
          <SectionTitle title="Moderatori" />
          <form
            className="mt-4 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await post("/moderation/moderators", { username: moderatorUsername })) {
                setModeratorUsername("");
              }
            }}
          >
            <input
              value={moderatorUsername}
              onChange={(e) => setModeratorUsername(e.target.value)}
              placeholder="username moderatore"
              className="min-w-0 flex-1 rounded-md border border-cam-border bg-cam-ink px-3 py-2 text-sm text-cam-text outline-none focus:border-cam-orange"
            />
            <button className="rounded-full bg-cam-cta px-3 py-2 text-xs font-bold text-cam-ink">
              Aggiungi
            </button>
          </form>
          <List empty="Nessun moderatore.">
            {data?.moderators.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-sm text-cam-text">@{m.user.username}</span>
                <button
                  type="button"
                  onClick={() => del(`/moderation/moderators/${m.user.id}`)}
                  className="text-xs font-bold text-red-300 hover:text-red-200"
                >
                  Rimuovi
                </button>
              </li>
            ))}
          </List>
        </div>

        <div className="rounded-md border border-cam-border bg-cam-card p-5 shadow-card">
          <SectionTitle title="Filtri parole" />
          <form
            className="mt-4 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await post("/moderation/words", { phrase: word })) setWord("");
            }}
          >
            <input
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder="parola o frase"
              className="min-w-0 flex-1 rounded-md border border-cam-border bg-cam-ink px-3 py-2 text-sm text-cam-text outline-none focus:border-cam-orange"
            />
            <button className="rounded-full bg-cam-cta px-3 py-2 text-xs font-bold text-cam-ink">
              Blocca
            </button>
          </form>
          <List empty="Nessuna parola filtrata.">
            {data?.wordFilters.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-sm text-cam-text">{w.phrase}</span>
                <button
                  type="button"
                  onClick={() => del(`/moderation/words/${w.id}`)}
                  className="text-xs font-bold text-red-300 hover:text-red-200"
                >
                  Elimina
                </button>
              </li>
            ))}
          </List>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-cam-border bg-cam-card p-5 shadow-card">
          <SectionTitle title="Mute / Ban attivi" />
          <List empty="Nessuna azione attiva.">
            {data?.actions.map((a) => (
              <li key={a.id} className="px-3 py-2 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-cam-text">
                      {a.type} · @{a.target.username}
                    </p>
                    <p className="text-xs text-cam-muted">
                      {a.reason || "nessun motivo"} · {a.expiresAt ? `fino a ${formatIsoUtc(a.expiresAt)}` : "permanente"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => del(`/moderation/actions/${a.id}`)}
                    className="text-xs font-bold text-emerald-300 hover:text-emerald-200"
                  >
                    Revoca
                  </button>
                </div>
              </li>
            ))}
          </List>
        </div>

        <div className="rounded-md border border-cam-border bg-cam-card p-5 shadow-card">
          <SectionTitle title="Report system" />
          <List empty="Nessun report.">
            {data?.reports.map((r) => (
              <li key={r.id} className="px-3 py-2 text-sm">
                <p className="font-bold text-cam-text">
                  {r.reason} · {r.status}
                </p>
                <p className="text-xs text-cam-muted">
                  Da @{r.reporter.username}
                  {r.target ? ` · target @${r.target.username}` : ""}
                  {r.stream ? ` · live ${r.stream.title || r.stream.id}` : ""}
                </p>
                {r.details && <p className="mt-1 text-xs text-cam-text">{r.details}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["REVIEWING", "RESOLVED", "REJECTED"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => patchReport(r.id, s)}
                      className="rounded-full border border-cam-border px-2 py-1 text-[11px] font-bold text-cam-muted hover:border-cam-orange hover:text-cam-text"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </List>
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h3 className="text-sm font-bold uppercase tracking-wider text-cam-text">
      {title}
    </h3>
  );
}

function List({
  children,
  empty,
}: {
  children: ReactNode;
  empty: string;
}) {
  const arr = Array.isArray(children) ? children.filter(Boolean) : children;
  const isEmpty = Array.isArray(arr) ? arr.length === 0 : !arr;
  return (
    <ul className="mt-4 divide-y divide-cam-border overflow-hidden rounded-md border border-cam-border bg-cam-ink">
      {isEmpty ? (
        <li className="px-3 py-3 text-sm text-cam-muted">{empty}</li>
      ) : (
        arr
      )}
    </ul>
  );
}
