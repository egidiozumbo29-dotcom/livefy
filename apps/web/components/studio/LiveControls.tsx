"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/services/api";
import { LiveChat } from "@/components/live/LiveChat";
import { formatInteger } from "@/lib/format";
import { ObsIngressPanel } from "./ObsIngressPanel";
import { StreamerPreview } from "./StreamerPreview";
import type { LiveState, ShowMode } from "./streamer-types";

export type { LiveState, ShowMode } from "./streamer-types";

type Props = {
  live: LiveState | null;
  loading: boolean;
  onChange: () => void;
};

const MODE_DESC: Record<ShowMode, string> = {
  PUBLIC:
    "Tutti possono entrare gratis. Puoi usare il tip menu per monetizzare.",
  BASE:
    "Privato a gruppo (ticket): quota fissa per entrare; più viewer con accesso. Combinalo con “nascondi home” o password invito.",
  PRIVATE:
    "Premium 1-on-1 pay-per-minute per un viewer; opzione spy per gli altri. Richiede acquisto sessione dalla pagina live.",
};

const CATEGORY_OPTIONS = [
  "Chat",
  "Dance",
  "Cosplay",
  "Couple",
  "Fitness",
  "Music",
  "Gaming",
  "Italian",
] as const;

const SETTINGS_KEY = "synthra-studio-live-settings";

type SavedLiveSettings = {
  title?: string;
  showMode?: ShowMode;
  category?: string;
  tagsText?: string;
  basePrice?: number;
  privatePricePerMinute?: number;
  spyPricePerMinute?: number;
  chatOpen?: boolean;
  isPrivate?: boolean;
};

function labelFor(m: ShowMode) {
  if (m === "PUBLIC") return "Pubblico";
  if (m === "BASE") return "Ticket gruppo";
  return "Premium 1v1";
}

function parseTags(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[,\s]+/)
        .map((tag) => tag.trim().replace(/^#/, "").toLowerCase())
        .filter((tag) => tag.length >= 2 && tag.length <= 32),
    ),
  ).slice(0, 12);
}

export function LiveControls({ live, loading, onChange }: Props) {
  const [title, setTitle] = useState("");
  const [showMode, setShowMode] = useState<ShowMode>("PUBLIC");
  const [category, setCategory] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [basePrice, setBasePrice] = useState(0);
  const [privatePricePerMinute, setPrivatePricePerMinute] = useState(0);
  const [spyPricePerMinute, setSpyPricePerMinute] = useState(0);
  const [chatOpen, setChatOpen] = useState(true);
  const [isPrivate, setIsPrivate] = useState(false);
  const [invitePassword, setInvitePassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [broadcastSource, setBroadcastSource] = useState<"browser" | "obs">(
    "browser",
  );

  useEffect(() => {
    try {
      const v = localStorage.getItem("synthra-studio-broadcast");
      if (v === "obs" || v === "browser") setBroadcastSource(v);
    } catch {
      /* noop */
    }
  }, []);

  function setBroadcastSourcePersist(next: "browser" | "obs") {
    setBroadcastSource(next);
    try {
      localStorage.setItem("synthra-studio-broadcast", next);
    } catch {
      /* noop */
    }
  }

  useEffect(() => {
    if (!live) {
      try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        const saved = raw ? (JSON.parse(raw) as SavedLiveSettings) : null;
        setTitle(saved?.title ?? "");
        setShowMode(saved?.showMode ?? "PUBLIC");
        setCategory(saved?.category ?? "");
        setTagsText(saved?.tagsText ?? "");
        setBasePrice(saved?.basePrice ?? 0);
        setPrivatePricePerMinute(saved?.privatePricePerMinute ?? 0);
        setSpyPricePerMinute(saved?.spyPricePerMinute ?? 0);
        setChatOpen(saved?.chatOpen ?? true);
        setIsPrivate(saved?.isPrivate ?? false);
      } catch {
        setTitle("");
        setShowMode("PUBLIC");
        setCategory("");
        setTagsText("");
        setBasePrice(0);
        setPrivatePricePerMinute(0);
        setSpyPricePerMinute(0);
        setChatOpen(true);
        setIsPrivate(false);
      }
      setInvitePassword("");
      return;
    }
    setTitle(live.title);
    setShowMode(live.showMode);
    setCategory(live.category ?? "");
    setTagsText((live.tags ?? []).join(", "));
    setBasePrice(live.basePrice);
    setPrivatePricePerMinute(live.privatePricePerMinute);
    setSpyPricePerMinute(live.spyPricePerMinute ?? 0);
    setChatOpen(live.chatOpen);
    setIsPrivate(live.isPrivate ?? false);
  }, [live]);

  useEffect(() => {
    if (live) return;
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({
          title,
          showMode,
          category,
          tagsText,
          basePrice,
          privatePricePerMinute,
          spyPricePerMinute,
          chatOpen,
          isPrivate,
        } satisfies SavedLiveSettings),
      );
    } catch {
      /* noop */
    }
  }, [
    live,
    title,
    showMode,
    category,
    tagsText,
    basePrice,
    privatePricePerMinute,
    spyPricePerMinute,
    chatOpen,
    isPrivate,
  ]);

  async function handleStart() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await apiFetch("/streams/start", {
        method: "POST",
        body: JSON.stringify({
          title,
          category,
          tags: parseTags(tagsText),
          showMode,
          basePrice,
          privatePricePerMinute,
          spyPricePerMinute,
          chatOpen,
          isPrivate,
          ...(invitePassword.trim().length >= 4
            ? { roomPassword: invitePassword.trim() }
            : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setMsg(
          typeof body.message === "string"
            ? body.message
            : "Avvio non riuscito.",
        );
        return;
      }
      setMsg("Sei live!");
      onChange();
    } finally {
      setBusy(false);
    }
  }

  async function handleStop() {
    if (!confirm("Terminare la live?")) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await apiFetch("/streams/stop", { method: "POST" });
      if (!res.ok) {
        setMsg("Stop non riuscito.");
        return;
      }
      onChange();
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await apiFetch("/streams/me", {
        method: "PATCH",
        body: JSON.stringify({
          title,
          category,
          tags: parseTags(tagsText),
          showMode,
          basePrice,
          privatePricePerMinute,
          spyPricePerMinute,
          chatOpen,
          isPrivate,
          ...(invitePassword.trim().length >= 4
            ? { roomPassword: invitePassword.trim() }
            : {}),
        }),
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
      setMsg("Modifiche salvate.");
      onChange();
    } finally {
      setBusy(false);
    }
  }

  async function toggleChat() {
    if (!live) return;
    setBusy(true);
    try {
      await apiFetch("/streams/me", {
        method: "PATCH",
        body: JSON.stringify({ chatOpen: !chatOpen }),
      });
      setChatOpen((v) => !v);
      onChange();
    } finally {
      setBusy(false);
    }
  }

  async function clearInvitePassword() {
    if (!live) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await apiFetch("/streams/me", {
        method: "PATCH",
        body: JSON.stringify({ clearRoomPassword: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setMsg(
          typeof body.message === "string"
            ? body.message
            : "Rimozione password non riuscita.",
        );
        return;
      }
      setInvitePassword("");
      setMsg("Password stanza rimossa.");
      onChange();
    } finally {
      setBusy(false);
    }
  }

  const isLive = !!live;
  const broadcastRoom = isLive && live?.room ? live.room : null;

  return (
    <div className="space-y-6">
      <ObsIngressPanel
        live={live}
        isLive={isLive}
        broadcastSource={broadcastSource}
        onSourceChange={setBroadcastSourcePersist}
        onRefresh={onChange}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-stretch">
        <StreamerPreview
          room={broadcastRoom}
          sessionLive={isLive}
          broadcastMode={broadcastSource}
          viewerCount={live?.viewers ?? 0}
        />

        {isLive && broadcastRoom && live ? (
          <div className="flex min-h-[420px] w-full min-w-0 flex-col lg:h-auto lg:min-h-0">
            <LiveChat
              fillColumn
              roomId={broadcastRoom}
              streamId={live.id}
              showMode={live.showMode}
              enforceLogin={false}
            />
          </div>
        ) : (
          <aside className="flex min-h-[280px] flex-col justify-center rounded-md border border-dashed border-cam-border bg-cam-ink/35 px-4 py-5 text-center lg:max-h-[min(100vh-12rem,620px)]">
            <p className="text-sm font-bold uppercase tracking-wide text-cam-muted">
              Chat live
            </p>
            <p className="mt-2 text-xs leading-relaxed text-cam-muted">
              Quando sei in diretta qui compare la stessa chat dei viewer: puoi
              leggere i messaggi e rispondere come nella pagina pubblica della
              live.
            </p>
          </aside>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-md border border-cam-border bg-cam-card p-5 shadow-card">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-cam-muted">
                Stato
              </p>
              <h2 className="text-xl font-bold text-cam-text">
                {isLive ? "Live in corso" : "Offline"}
              </h2>
              {isLive && (
                <p className="mt-1 text-xs text-cam-muted">
                  stanza{" "}
                  <code className="text-cam-orange-bright">{live?.room}</code> ·{" "}
                  {formatInteger(live?.viewers ?? 0)} spettatori
                </p>
              )}
            </div>
            {isLive ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={toggleChat}
                  disabled={busy}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                    chatOpen
                      ? "border-emerald-300 text-emerald-700 hover:border-emerald-500"
                      : "border-cam-border text-cam-muted hover:border-cam-orange/60"
                  }`}
                >
                  {chatOpen ? "Chat aperta" : "Chat chiusa"}
                </button>
                <button
                  type="button"
                  onClick={handleStop}
                  disabled={busy}
                  className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white shadow hover:bg-red-700"
                >
                  Termina live
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleStart}
                disabled={busy || loading}
                className="rounded-full bg-cam-cta px-5 py-2 text-xs font-bold uppercase tracking-wide text-cam-ink shadow disabled:opacity-50"
              >
                {busy ? "Avvio..." : "Vai live"}
              </button>
            )}
          </header>

          <div className="mt-5 space-y-4">
            <label className="block text-xs font-semibold uppercase tracking-wider text-cam-muted">
              Titolo
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                className="mt-1 w-full rounded-md border border-cam-border bg-cam-ink px-3 py-2 text-sm text-cam-text focus:border-cam-orange focus:outline-none focus:ring-2 focus:ring-cam-orange/35"
              />
            </label>

            <fieldset>
              <legend className="text-xs font-bold uppercase tracking-wider text-cam-muted">
                Modalita show
              </legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {(["PUBLIC", "BASE", "PRIVATE"] as ShowMode[]).map((m) => {
                  const active = showMode === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setShowMode(m)}
                      aria-pressed={active}
                      className={`rounded-md border px-3 py-2 text-left text-xs transition ${
                        active
                          ? "border-cam-orange bg-cam-orange/15 text-cam-orange-bright"
                          : "border-cam-border bg-cam-ink text-cam-text hover:border-cam-orange"
                      }`}
                    >
                      <span className="block text-sm font-bold">
                        {labelFor(m)}
                      </span>
                      <span className="mt-1 block text-[11px] text-cam-muted">
                        {MODE_DESC[m]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-cam-muted">
                Prezzo Privato (token sblocco)
                <input
                  type="number"
                  min={0}
                  max={1000000}
                  value={basePrice}
                  onChange={(e) => setBasePrice(Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded-md border border-cam-border bg-cam-ink px-3 py-2 text-sm text-cam-text focus:border-cam-orange focus:outline-none focus:ring-2 focus:ring-cam-orange/35"
                />
                <span className="mt-1 block text-[10px] normal-case text-cam-muted">
                  Quota fissa pagata una volta dai viewer per entrare.
                  Attivabile solo con &quot;Ticket gruppo&quot;.
                </span>
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wider text-cam-muted">
                Prezzo Premium 1v1 (token / minuto)
                <input
                  type="number"
                  min={0}
                  max={1000000}
                  value={privatePricePerMinute}
                  onChange={(e) =>
                    setPrivatePricePerMinute(Number(e.target.value) || 0)
                  }
                  className="mt-1 w-full rounded-md border border-cam-border bg-cam-ink px-3 py-2 text-sm text-cam-text focus:border-cam-orange focus:outline-none focus:ring-2 focus:ring-cam-orange/35"
                />
                <span className="mt-1 block text-[10px] normal-case text-cam-muted">
                  Tariffa al minuto del 1-on-1 esclusivo. Attivabile solo nella
                  modalita &quot;Premium 1v1&quot;.
                </span>
              </label>
            </div>

            <label className="block text-xs font-semibold uppercase tracking-wider text-cam-muted">
              Prezzo Spy show (token / minuto)
              <input
                type="number"
                min={0}
                max={1000000}
                value={spyPricePerMinute}
                onChange={(e) =>
                  setSpyPricePerMinute(Number(e.target.value) || 0)
                }
                className="mt-1 w-full rounded-md border border-cam-border bg-cam-ink px-3 py-2 text-sm text-cam-text focus:border-cam-orange focus:outline-none focus:ring-2 focus:ring-cam-orange/35"
              />
              <span className="mt-1 block text-[10px] normal-case text-cam-muted">
                Tariffa ridotta al minuto per gli &quot;spia&quot; durante il
                Premium 1v1. Lascia 0 per disattivarlo. Attivabile solo nella
                modalita Premium 1v1.
              </span>
            </label>

            <label className="flex items-center gap-3 rounded-md border border-cam-border bg-cam-ink/80 px-3 py-2 text-sm text-cam-text">
              <input
                type="checkbox"
                checked={chatOpen}
                onChange={(e) => setChatOpen(e.target.checked)}
                className="h-4 w-4"
              />
              <span>
                Chat aperta ai viewer
                <span className="ml-2 text-[11px] text-cam-muted">
                  Se disattivata i viewer vedono il video ma non possono
                  scrivere.
                </span>
              </span>
            </label>

            <label className="flex items-center gap-3 rounded-md border border-cam-border bg-cam-ink/80 px-3 py-2 text-sm text-cam-text">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="h-4 w-4"
              />
              <span>
                Nascondi dalla home / Discover (stanza privata)
                <span className="ml-2 text-[11px] text-cam-muted">
                  La live non appare nell&apos;elenco pubblico: gli spettatori
                  entrano tramite link profilo o stanza diretta; puoi aggiungere
                  anche la password invito qui sotto.
                </span>
              </span>
            </label>

            <div className="rounded-md border border-cam-border bg-cam-ink/80 px-3 py-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-cam-muted">
                Password invito (viewer)
                <input
                  type="password"
                  autoComplete="new-password"
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  placeholder={
                    live?.hasRoomPassword
                      ? "Lascia vuoto per non modificare · min 4 per nuova"
                      : "Opzionale · minimo 4 caratteri per attivarla"
                  }
                  maxLength={200}
                  className="mt-1 w-full rounded-md border border-cam-border bg-cam-bg px-3 py-2 text-sm text-cam-text focus:border-cam-orange focus:outline-none focus:ring-2 focus:ring-cam-orange/35"
                />
              </label>
              <p className="mt-1 text-[11px] text-cam-muted">
                Chi non ha la password non ottiene il token LiveKit. La stanza non
                compare in Discover se imposti anche &quot;nascondi home&quot;, o
                comunque resta protetta.
              </p>
              {isLive && live?.hasRoomPassword ? (
                <button
                  type="button"
                  onClick={clearInvitePassword}
                  disabled={busy}
                  className="mt-2 text-xs font-bold uppercase tracking-wide text-cam-orange-bright underline-offset-2 hover:underline disabled:opacity-50"
                >
                  Rimuovi password stanza
                </button>
              ) : null}
            </div>

            {msg && (
              <p className="rounded-md bg-cam-ink px-3 py-2 text-xs text-cam-muted">
                {msg}
              </p>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              {isLive ? (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={busy}
                  className="rounded-full bg-cam-cta px-4 py-2 text-sm font-bold uppercase tracking-wide text-cam-ink shadow disabled:opacity-50"
                >
                  {busy ? "Salvo..." : "Salva modifiche"}
                </button>
              ) : (
                <p className="text-xs text-cam-muted">
                  Le impostazioni saranno applicate quando vai live.
                </p>
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-md border border-cam-border bg-cam-card p-5 shadow-card">
            <h3 className="text-sm font-bold uppercase tracking-wider text-cam-text">
              Le tre modalita
            </h3>
            <ul className="mt-3 space-y-2 text-xs text-cam-muted">
              <li>
                <strong className="text-cam-text">Pubblico</strong> —
                accessibile a tutti gratis. Monetizzi con tip e tip menu.
              </li>
              <li>
                <strong className="text-cam-text">Ticket gruppo</strong> — show
                a gruppo: quota fissa per entrare; più viewer con accesso.
                Combinalo con &quot;nascondi home&quot; o password invito per
                accesso limitato.
              </li>
              <li>
                <strong className="text-cam-text">Premium 1v1</strong> — pay per
                minuto 1-on-1; opzionale spy a tariffa ridotta per gli altri
                viewer.
              </li>
              <li className="text-cam-muted">
                I prezzi sono validi solo nella modalita corrispondente: cosi i
                viewer vedono sempre il prezzo corretto e non puoi
                preimpostarlo.
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
