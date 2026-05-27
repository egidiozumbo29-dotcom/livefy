"use client";

import { Link } from "@/i18n/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/services/api";
import { dispatchBalanceSync } from "@/hooks/useBalanceSync";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { updateBalance } from "@/store/slices/authSlice";
import { formatInteger } from "@/lib/format";

export type ShowMode = "PUBLIC" | "BASE" | "PRIVATE";

export type AccessState =
  | { live: false }
  | {
      live: true;
      streamId: string;
      showMode: ShowMode;
      basePrice: number;
      privatePricePerMinute: number;
      spyPricePerMinute: number;
      isStreamer: boolean;
      hasBaseTicket: boolean;
      isInPrivate: boolean;
      streamerInPrivate?: boolean;
      privateStartedAt?: string | null;
      currentPrivateViewerId?: string | null;
      privateLocked: boolean;
      privateExclusive: boolean;
      privateTicketId: string | null;
      privatePricePaid: number;
      isSpying: boolean;
      spyTicketId: string | null;
      spyPricePaid: number;
      spyAvailable: boolean;
    };

type Props = {
  creatorId: string;
  onAccessChange?: () => void;
  forcePrivateShow?: boolean;
};

const TICK_INTERVAL_MS = 60_000;

function formatDuration(totalSeconds: number) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function ShowAccessPanel({
  creatorId,
  onAccessChange,
  forcePrivateShow = false,
}: Props) {
  const token = useAppSelector((s) => s.auth.token);
  const balance = useAppSelector((s) => s.auth.user?.balance ?? 0);
  const dispatch = useAppDispatch();

  const [state, setState] = useState<AccessState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [privateChooserOpen, setPrivateChooserOpen] = useState(false);
  const [privateElapsedSeconds, setPrivateElapsedSeconds] = useState(0);
  const privateSeenAtRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onAccessChangeRef = useRef(onAccessChange);
  useEffect(() => {
    onAccessChangeRef.current = onAccessChange;
  }, [onAccessChange]);

  const refresh = useCallback(async () => {
    if (!token) {
      setState(null);
      return;
    }
    const res = await apiFetch(`/streams/access/me/${encodeURIComponent(creatorId)}`);
    if (!res.ok) {
      setState({ live: false });
      return;
    }
    const data = (await res.json()) as AccessState;
    setState(data);
  }, [creatorId, token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!state?.live) {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
      return;
    }
    const isPrivateActive = state.isInPrivate;
    const isSpyActive = state.isSpying;
    if (!isPrivateActive && !isSpyActive) {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
      return;
    }
    const endpoint = isPrivateActive
      ? "/streams/private/tick"
      : "/streams/spy/tick";
    const id = setInterval(async () => {
      try {
        const res = await apiFetch(endpoint, {
          method: "POST",
          body: JSON.stringify({ streamId: state.streamId }),
        });
        if (!res.ok) {
          if (res.status === 402) {
            setMsg(
              isPrivateActive
                ? "Token finiti: sessione privata terminata."
                : "Token finiti: spy terminato.",
            );
            await refresh();
            onAccessChangeRef.current?.();
            return;
          }
          if (res.status === 403) {
            setMsg(
              isPrivateActive
                ? "Premium 1v1 chiuso dalla streamer."
                : "Spy non piu disponibile.",
            );
            await refresh();
            onAccessChangeRef.current?.();
            return;
          }
          return;
        }
        const body = (await res.json()) as { charged?: number };
        if (typeof body.charged === "number" && body.charged > 0) {
          dispatch(updateBalance(Math.max(0, balance - body.charged)));
          dispatchBalanceSync();
        }
      } catch {
        // ignore
      }
    }, TICK_INTERVAL_MS);
    tickRef.current = id;
    return () => {
      clearInterval(id);
      tickRef.current = null;
    };
  }, [state?.live, state, dispatch, refresh, balance]);

  const privateActive =
    state?.live === true && (state.isInPrivate || state.streamerInPrivate);

  useEffect(() => {
    if (!privateActive) {
      privateSeenAtRef.current = null;
      setPrivateElapsedSeconds(0);
      return;
    }
    if (privateSeenAtRef.current == null) {
      privateSeenAtRef.current = state.privateStartedAt
        ? new Date(state.privateStartedAt).getTime()
        : Date.now();
    }
    const update = () => {
      const started = privateSeenAtRef.current ?? Date.now();
      setPrivateElapsedSeconds(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [privateActive, state?.live, state?.live === true ? state.privateStartedAt : null]);

  async function buyBase() {
    if (!state?.live) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await apiFetch("/streams/access/base", {
        method: "POST",
        body: JSON.stringify({ streamId: state.streamId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setMsg(messageFor(res.status, body));
        return;
      }
      dispatch(updateBalance(Math.max(0, balance - state.basePrice)));
      dispatchBalanceSync();
      await refresh();
      onAccessChangeRef.current?.();
    } finally {
      setBusy(false);
    }
  }

  async function requestPrivate(exclusive = false) {
    if (!state?.live) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await apiFetch("/streams/private/request", {
        method: "POST",
        body: JSON.stringify({ streamId: state.streamId, exclusive }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setMsg(messageFor(res.status, body));
        return;
      }
      setMsg(
        exclusive
          ? "Richiesta privato esclusivo inviata alla modella."
          : "Richiesta privato normale inviata alla modella.",
      );
      await refresh();
      setPrivateChooserOpen(false);
      onAccessChangeRef.current?.();
    } finally {
      setBusy(false);
    }
  }

  async function endPrivate() {
    if (!state?.live) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await apiFetch("/streams/private/end", {
        method: "POST",
        body: JSON.stringify({ streamId: state.streamId }),
      });
      if (!res.ok) {
        setMsg("Impossibile terminare il privato.");
        return;
      }
      await refresh();
      onAccessChangeRef.current?.();
    } finally {
      setBusy(false);
    }
  }

  async function startSpy() {
    if (!state?.live) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await apiFetch("/streams/spy/start", {
        method: "POST",
        body: JSON.stringify({ streamId: state.streamId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setMsg(messageFor(res.status, body));
        return;
      }
      dispatch(updateBalance(Math.max(0, balance - state.spyPricePerMinute)));
      dispatchBalanceSync();
      await refresh();
      onAccessChangeRef.current?.();
    } finally {
      setBusy(false);
    }
  }

  async function endSpy() {
    if (!state?.live) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await apiFetch("/streams/spy/end", {
        method: "POST",
        body: JSON.stringify({ streamId: state.streamId }),
      });
      if (!res.ok) {
        setMsg("Impossibile terminare lo spy.");
        return;
      }
      await refresh();
      onAccessChangeRef.current?.();
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="rounded-md border border-cam-border bg-cam-card p-4 text-sm text-cam-text shadow-card">
        <Link href="/login" className="font-semibold text-cam-orange-bright hover:underline">
          Accedi
        </Link>{" "}
        per accedere agli show a pagamento.
      </div>
    );
  }
  if (!state) return null;
  if (!state.live) return null;
  if (state.isStreamer) return null;

  // Privato (ticket gruppo) → solo se la streamer e' in modalita BASE
  // Premium 1v1 → solo se la streamer e' in modalita PRIVATE
  // Spy → solo durante un Premium 1v1 attivo (gestito dal backend con spyAvailable)
  const showBaseBlock = state.showMode === "BASE";
  const showPremiumBlock =
    state.showMode === "PRIVATE" || state.isInPrivate || forcePrivateShow;
  const showSpyBlock = state.spyAvailable || state.isSpying;
  if (!showBaseBlock && !showPremiumBlock && !showSpyBlock) return null;

  return (
    <div className="space-y-3">
      {showBaseBlock && (
        <div className="rounded-md border border-cam-orange/40 bg-cam-orange/10 p-4 shadow-card">
          <header className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-bold text-cam-text">
              Show privato (gruppo)
            </h3>
            <span className="text-[11px] text-cam-muted">
              Balance:{" "}
              <span className="tabular-nums font-bold">
                {formatInteger(balance)}
              </span>{" "}
              tk
            </span>
          </header>
          {state.hasBaseTicket ? (
            <p className="text-xs text-emerald-700">
              ✓ Hai accesso al privato. Goditi lo show.
            </p>
          ) : (
            <>
              <p className="text-xs text-cam-muted">
                Ticket show: paga una volta per accedere insieme agli altri
                viewer.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={buyBase}
                className="btn-tip mt-3 w-full"
              >
                {busy
                  ? "Sblocco..."
                  : `Entra per ${formatInteger(state.basePrice)} tk`}
              </button>
            </>
          )}
        </div>
      )}

      {showPremiumBlock && (
        <div className="rounded-md border border-cam-orange/45 bg-cam-orange/12 p-4 shadow-card">
          <header className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-bold text-cam-text">
              Private show
            </h3>
            <span className="text-[11px] text-cam-muted">
              Balance:{" "}
              <span className="tabular-nums font-bold">
                {formatInteger(balance)}
              </span>{" "}
              tk
            </span>
          </header>
          {state.isInPrivate || state.streamerInPrivate ? (
            <>
              <p className="text-xs text-emerald-700">
                ✓ {state.isStreamer ? "Private show attivo" : "Sei in private show"} ·{" "}
                {state.privateExclusive ? "Privato esclusivo" : "Privato normale"} · Timer{" "}
                <strong className="tabular-nums">
                  {formatDuration(privateElapsedSeconds)}
                </strong>
                {!state.isStreamer && (
                  <>
                    {" "}· Tariffa{" "}
                    <strong className="tabular-nums">
                      {formatInteger(state.privatePricePerMinute)}
                    </strong>{" "}
                    tk/min · spesi finora{" "}
                    <strong className="tabular-nums">
                      {formatInteger(state.privatePricePaid)}
                    </strong>{" "}
                    tk
                  </>
                )}
                .
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={endPrivate}
                className="mt-3 w-full rounded-full border border-cam-border bg-cam-ink px-4 py-2 text-sm font-semibold text-cam-text hover:border-red-500 hover:text-red-400"
              >
                Termina Premium 1v1
              </button>
            </>
          ) : state.privateLocked ? (
            <p className="text-xs text-cam-muted">
              Premium 1v1 gia in corso con un altro viewer. Riprova piu tardi.
            </p>
          ) : state.privatePricePerMinute <= 0 ? (
            <p className="text-xs text-cam-muted">
              La streamer non ha ancora impostato la tariffa.
            </p>
          ) : (
            <>
              {!privateChooserOpen ? (
                <>
                  <p className="text-xs text-cam-muted">
                    Clicca per richiedere uno show privato alla modella e
                    scegliere tra privato normale o esclusivo.
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setPrivateChooserOpen(true)}
                    className="btn-tip-lg mt-3 w-full"
                  >
                    Richiedi private show ·{" "}
                    {formatInteger(state.privatePricePerMinute)} tk/min
                  </button>
                </>
              ) : (
                <div className="mt-3 rounded-2xl border border-cam-border bg-cam-ink/90 p-3">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-cam-text">
                        Scegli tipo di private show
                      </p>
                      <p className="mt-1 text-[11px] text-cam-muted">
                        La tariffa parte subito per il primo minuto, poi viene
                        scalata ogni 60 secondi finche termini lo show.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPrivateChooserOpen(false)}
                      className="rounded-full border border-cam-border px-2 py-1 text-[10px] font-bold uppercase text-cam-muted hover:border-cam-orange hover:text-cam-orange-bright"
                    >
                      Chiudi
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => requestPrivate(false)}
                      className="rounded-xl border border-cam-orange/50 bg-cam-orange/10 px-3 py-3 text-left text-xs text-cam-text hover:border-cam-orange-bright disabled:opacity-50"
                    >
                      <span className="block font-bold text-cam-orange-bright">
                        Privato normale
                      </span>
                      <span className="mt-1 block text-cam-muted">
                        Tu parli con la modella in chat privata. Gli altri
                        spettatori possono guardare pagando lo spy token/minuto,
                        ma non possono scrivere.
                      </span>
                      <span className="mt-2 block font-bold">
                        {formatInteger(state.privatePricePerMinute)} tk/min
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => requestPrivate(true)}
                      className="rounded-xl border border-rose-400/60 bg-rose-500/10 px-3 py-3 text-left text-xs text-cam-text hover:border-rose-300 disabled:opacity-50"
                    >
                      <span className="block font-bold text-rose-300">
                        Privato esclusivo
                      </span>
                      <span className="mt-1 block text-cam-muted">
                        Accesso chiuso: restate solo tu e la modella. Nessuno
                        può entrare come spy o guardare lo show.
                      </span>
                      <span className="mt-2 block font-bold">
                        {formatInteger(state.privatePricePerMinute)} tk/min
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {showSpyBlock && (
        <div className="rounded-md border border-cam-border bg-cam-ink p-4 shadow-card">
          <header className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-bold text-cam-orange-bright">
              Spy show 🕵️
            </h3>
            <span className="text-[11px] text-cam-muted">
              Balance:{" "}
              <span className="tabular-nums font-bold">
                {formatInteger(balance)}
              </span>{" "}
              tk
            </span>
          </header>
          {state.isSpying ? (
            <>
              <p className="text-xs text-emerald-700">
                ✓ Stai spiando il Premium 1v1. Tariffa:{" "}
                <strong className="tabular-nums">
                  {formatInteger(state.spyPricePerMinute)}
                </strong>{" "}
                tk/min · spesi{" "}
                <strong className="tabular-nums">
                  {formatInteger(state.spyPricePaid)}
                </strong>{" "}
                tk.
              </p>
              <p className="mt-1 text-[11px] text-cam-muted">
                In modalita spy puoi guardare ma non puoi scrivere in chat.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={endSpy}
                className="mt-3 w-full rounded-full border border-cam-border bg-cam-ink px-4 py-2 text-sm font-semibold text-cam-text hover:border-red-500 hover:text-red-400"
              >
                Esci dallo spy
              </button>
            </>
          ) : state.spyAvailable ? (
            <>
              <p className="text-xs text-cam-muted">
                Un altro viewer e in Premium 1v1. Puoi spiare a tariffa
                ridotta:{" "}
                <strong className="tabular-nums">
                  {formatInteger(state.spyPricePerMinute)}
                </strong>{" "}
                tk/min.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={startSpy}
                className="mt-3 w-full rounded-full bg-cam-cta px-4 py-2 text-sm font-bold uppercase tracking-wide text-cam-ink shadow disabled:opacity-50"
              >
                {busy
                  ? "Avvio..."
                  : `Spia per ${formatInteger(state.spyPricePerMinute)} tk/min`}
              </button>
            </>
          ) : null}
        </div>
      )}

      {msg && (
        <p className="rounded-md border border-cam-border bg-cam-card px-3 py-2 text-xs text-cam-text">
          {msg}
        </p>
      )}
    </div>
  );
}

function messageFor(status: number, body: { message?: unknown }) {
  if (status === 402) return "Token insufficienti: ricarica il wallet.";
  if (status === 409)
    return "Premium 1v1 gia in corso con un altro viewer. Riprova piu tardi.";
  if (status === 403) return "Accesso negato.";
  if (status === 404) return "Live non trovata o terminata.";
  if (typeof body.message === "string") {
    if (body.message === "premium_non_attivo") {
      return "La streamer non e' in modalita Premium 1v1 in questo momento.";
    }
    if (body.message === "premium_non_configurato") {
      return "La streamer non ha ancora impostato la tariffa Premium 1v1.";
    }
    if (body.message === "show_non_base") {
      return "La streamer non e' in modalita Privato in questo momento.";
    }
    if (body.message === "spy_non_attivo" || body.message === "nessun_premium_in_corso") {
      return "Nessun Premium 1v1 in corso da spiare.";
    }
    if (body.message === "spy_non_configurato") {
      return "La streamer non ha attivato lo spy show.";
    }
    return body.message;
  }
  return `Errore ${status}`;
}
