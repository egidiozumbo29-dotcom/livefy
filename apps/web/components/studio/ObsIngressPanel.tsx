"use client";

import { useCallback, useState } from "react";
import { apiFetch } from "@/services/api";
import type { StreamerLiveSnapshot } from "./streamer-types";

type Props = {
  live: StreamerLiveSnapshot | null;
  isLive: boolean;
  broadcastSource: "browser" | "obs";
  onSourceChange: (s: "browser" | "obs") => void;
  onRefresh: () => void;
};

async function copyText(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    prompt(label, value);
    return false;
  }
}

export function ObsIngressPanel({
  live,
  isLive,
  broadcastSource,
  onSourceChange,
  onRefresh,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const hasObs = !!(live?.obs?.rtmpUrl && live?.obs?.streamKey);

  const createOrRotate = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await apiFetch("/streams/ingress/obs", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setMsg(
          typeof body.message === "string"
            ? body.message
            : res.status === 503
              ? "LiveKit non configurato (LIVEKIT_URL, API key/secret)."
              : "Impossibile creare l'ingress OBS.",
        );
        return;
      }
      setMsg("Credenziali RTMP pronte. Incollale in OBS.");
      onRefresh();
    } finally {
      setBusy(false);
    }
  }, [onRefresh]);

  const removeIngress = useCallback(async () => {
    if (!confirm("Rimuovere il collegamento OBS? Potrai crearne uno nuovo dopo.")) {
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await apiFetch("/streams/ingress/obs", { method: "DELETE" });
      if (!res.ok) {
        setMsg("Rimozione non riuscita.");
        return;
      }
      onRefresh();
      onSourceChange("browser");
    } finally {
      setBusy(false);
    }
  }, [onRefresh, onSourceChange]);

  return (
    <section className="rounded-md border border-cam-border bg-cam-card p-5 shadow-card">
      <header className="mb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cam-orange-bright">
          Trasmissione
        </p>
        <h2 className="mt-1 text-lg font-bold text-cam-text">
          Webcam browser oppure OBS Studio
        </h2>
        <p className="mt-1 text-sm text-cam-muted">
          Scegli come invii video e audio alla live. OBS usa RTMP verso{" "}
          <strong className="text-cam-text">LiveKit Ingress</strong> (richiede
          variabili LIVEKIT_* sull&apos;API).
        </p>
      </header>

      <div className="flex flex-wrap gap-2 rounded-lg border border-cam-border bg-cam-ink p-1">
        <button
          type="button"
          onClick={() => onSourceChange("browser")}
          className={`flex-1 rounded-md px-3 py-2 text-center text-sm font-semibold transition ${
            broadcastSource === "browser"
              ? "bg-cam-orange text-cam-ink shadow"
              : "text-cam-muted hover:text-cam-text"
          }`}
        >
          Browser (WebRTC)
        </button>
        <button
          type="button"
          onClick={() => onSourceChange("obs")}
          className={`flex-1 rounded-md px-3 py-2 text-center text-sm font-semibold transition ${
            broadcastSource === "obs"
              ? "bg-cam-orange text-cam-ink shadow"
              : "text-cam-muted hover:text-cam-text"
          }`}
        >
          OBS (RTMP)
        </button>
      </div>

      {broadcastSource === "obs" && (
        <div className="mt-5 space-y-4 border-t border-cam-border pt-5">
          {!isLive && (
            <p className="text-sm text-amber-200/90">
              Avvia prima la live con il pulsante &quot;Vai live&quot; qui sotto,
              poi genera le credenziali RTMP.
            </p>
          )}

          {isLive && (
            <>
              <p className="text-[11px] leading-relaxed text-cam-muted">
                Per HD e latenza bassa: in OBS → Video imposta uscita{" "}
                <strong className="text-cam-text">1280×720</strong> o{" "}
                <strong className="text-cam-text">1920×1080</strong> a{" "}
                <strong className="text-cam-text">30 fps</strong>; in Output (encoder) usa{" "}
                <strong className="text-cam-text">keyframe ogni 2 s</strong> se disponibile.
              </p>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-cam-muted">
                <li>Apri OBS → Impostazioni → Trasmissione.</li>
                <li>Servizio: <strong className="text-cam-text">Personalizzato</strong>.</li>
                <li>Incolla <strong className="text-cam-text">Server RTMP</strong> e{" "}
                  <strong className="text-cam-text">Chiave stream</strong> nei campi
                  sotto (alcuni build di LiveKit mostrano un unico URL: usa il
                  campo Server per l&apos;host e la chiave dove richiesto).</li>
                <li>Avvia trasmissione in OBS: il video entra nella stessa stanza dei viewer.</li>
              </ol>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || !isLive}
                  onClick={() => void createOrRotate()}
                  className="rounded-full bg-cam-cta px-4 py-2 text-sm font-bold text-cam-ink shadow hover:opacity-95 disabled:opacity-50"
                >
                  {hasObs ? "Rigenera credenziali RTMP" : "Genera credenziali RTMP"}
                </button>
                {hasObs && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removeIngress()}
                    className="rounded-full border border-cam-border px-4 py-2 text-sm font-semibold text-cam-muted hover:border-amber-500/50 hover:text-amber-200 disabled:opacity-50"
                  >
                    Rimuovi collegamento OBS
                  </button>
                )}
              </div>

              {msg && (
                <p className="rounded-md border border-cam-border bg-cam-ink px-3 py-2 text-sm text-cam-text">
                  {msg}
                </p>
              )}

              {hasObs && live.obs && (
                <dl className="space-y-3 rounded-lg border border-cam-border bg-cam-ink p-4 text-sm">
                  <div>
                    <dt className="font-semibold text-cam-muted">Server RTMP</dt>
                    <dd className="mt-1 flex flex-wrap items-center gap-2 break-all font-mono text-xs text-cam-text">
                      {live.obs.rtmpUrl}
                      <button
                        type="button"
                        className="shrink-0 rounded border border-cam-border px-2 py-0.5 text-[11px] uppercase text-cam-orange-bright"
                        onClick={() =>
                          void copyText("Server RTMP", live.obs!.rtmpUrl)
                        }
                      >
                        Copia
                      </button>
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-cam-muted">Chiave stream</dt>
                    <dd className="mt-1 flex flex-wrap items-center gap-2 break-all font-mono text-xs text-cam-text">
                      {live.obs.streamKey}
                      <button
                        type="button"
                        className="shrink-0 rounded border border-cam-border px-2 py-0.5 text-[11px] uppercase text-cam-orange-bright"
                        onClick={() =>
                          void copyText("Chiave stream", live.obs!.streamKey)
                        }
                      >
                        Copia
                      </button>
                    </dd>
                  </div>
                </dl>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
