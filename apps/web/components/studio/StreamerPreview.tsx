"use client";

import { useEffect, useRef, useState } from "react";
import { LiveKitPlayer } from "@/components/live/LiveKitPlayer";

type Props = {
  /** Nome stanza LiveKit (`stream.roomId`). */
  room: string | null;
  /** True se la tua live e' attiva (API). */
  sessionLive: boolean;
  /** Come invii la sorgente nella stanza. */
  broadcastMode: "browser" | "obs";
  viewerCount?: number;
};

/**
 * Anteprima sempre visibile nello Studio:
 *  - Live offline: getUserMedia locale (preview camera/mic) per testare l'inquadratura.
 *  - Live online: LiveKitPlayer in modalita publisher (controlla mic/cam dalla bar).
 */
export function StreamerPreview({
  room,
  sessionLive,
  broadcastMode,
  viewerCount,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permState, setPermState] = useState<"idle" | "loading" | "ready" | "denied">(
    "idle",
  );
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);

  useEffect(() => {
    if (sessionLive) {
      cleanup();
      return;
    }
    let cancelled = false;

    async function start() {
      setPermState("loading");
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: { ideal: "user" },
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          await videoRef.current.play().catch(() => {});
        }
        setPermState("ready");
      } catch (err) {
        const e = err as DOMException;
        setError(humanError(e));
        setPermState("denied");
      }
    }

    start();

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLive]);

  function cleanup() {
    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
    }
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  function toggleCam() {
    const s = streamRef.current;
    if (!s) return;
    const track = s.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
  }

  function toggleMic() {
    const s = streamRef.current;
    if (!s) return;
    const track = s.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  }

  if (sessionLive && room && broadcastMode === "browser") {
    return (
      <section className="overflow-hidden rounded-md border border-red-500/45 bg-cam-card shadow-card">
        <header className="flex items-center justify-between gap-3 border-b border-cam-border bg-cam-ink px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              On air
            </span>
            <h3 className="text-sm font-bold text-cam-text">
              Anteprima (browser WebRTC)
            </h3>
          </div>
          <p className="text-[11px] text-cam-muted">
            Cam/mic dalla barra in basso. Per OBS usa la scheda sopra.
          </p>
        </header>
        <div className="aspect-video bg-black">
          <LiveKitPlayer
            key={room}
            room={room}
            isLive={true}
            asPublisher={true}
            viewerCount={viewerCount}
            liveLabel="On air"
          />
        </div>
      </section>
    );
  }

  if (sessionLive && broadcastMode === "obs") {
    return (
      <section className="overflow-hidden rounded-md border border-cam-orange/50 bg-cam-card shadow-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-cam-border bg-cam-ink px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded bg-cam-orange px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cam-ink">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cam-ink" />
              On air · OBS
            </span>
            <h3 className="text-sm font-bold text-cam-text">
              Sorgente da OBS (RTMP)
            </h3>
          </div>
        </header>
        <div className="flex aspect-video flex-col items-center justify-center gap-3 bg-black p-8 text-center">
          <p className="max-w-md text-sm text-gray-200">
            Il video pubblicato dal browser è disattivato: usa OBS con le
            credenziali RTMP nella scheda <strong className="text-white">Trasmissione</strong>{" "}
            sopra. I viewer vedono il feed OBS nella stessa stanza.
          </p>
          <p className="text-[11px] text-gray-500">
            Scena vuota finché OBS non avvia la trasmissione.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-md border border-cam-border bg-cam-card shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-cam-border bg-cam-ink px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-cam-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-cam-muted">
            Anteprima locale
          </span>
          <h3 className="text-sm font-bold text-cam-text">
            Inquadratura e audio
          </h3>
        </div>
        <p className="text-[11px] text-cam-muted">
          Solo tu vedi questa anteprima. Quando vai live sostituiamo con il flusso pubblicato.
        </p>
      </header>

      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
        />
        {permState === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-sm text-gray-200">
            Richiesta accesso webcam/microfono…
          </div>
        )}
        {permState === "denied" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/85 px-6 text-center">
            <p className="text-sm text-red-300">{error}</p>
            <p className="text-[11px] text-gray-300">
              Concedi i permessi nel browser e ricarica la pagina.
            </p>
          </div>
        )}
        {!camOn && permState === "ready" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-sm text-gray-200">
            Camera disattivata
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-cam-border bg-cam-ink px-3 py-2">
        <button
          type="button"
          onClick={toggleCam}
          disabled={permState !== "ready"}
          className={`rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition ${
            camOn
              ? "border-emerald-500/50 bg-cam-bg text-emerald-300"
              : "border-cam-border bg-cam-bg text-cam-muted"
          } disabled:opacity-50`}
          aria-pressed={!camOn}
        >
          {camOn ? "Camera ON" : "Camera OFF"}
        </button>
        <button
          type="button"
          onClick={toggleMic}
          disabled={permState !== "ready"}
          className={`rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition ${
            micOn
              ? "border-emerald-500/50 bg-cam-bg text-emerald-300"
              : "border-cam-border bg-cam-bg text-cam-muted"
          } disabled:opacity-50`}
          aria-pressed={!micOn}
        >
          {micOn ? "Mic ON" : "Mic OFF"}
        </button>
      </div>
    </section>
  );
}

function humanError(e: DOMException) {
  if (!e?.name) return "Impossibile accedere a webcam o microfono.";
  switch (e.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Permessi webcam/microfono negati dal browser.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "Nessuna webcam o microfono disponibile.";
    case "NotReadableError":
      return "Webcam o microfono in uso da un'altra applicazione.";
    default:
      return `Errore webcam: ${e.name}`;
  }
}
