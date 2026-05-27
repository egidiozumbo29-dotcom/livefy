"use client";

import "@livekit/components-styles";

import {
  ControlBar,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
  LiveKitRoom,
} from "@livekit/components-react";
import {
  Track,
  VideoPresets,
  VideoQuality,
  type RoomOptions,
} from "livekit-client";
import { Link } from "@/i18n/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { apiFetch } from "@/services/api";
import { useAppSelector } from "@/store/hooks";
import { formatInteger } from "@/lib/format";

/** WebRTC: simulcast + adaptiveStream/dynacast = latenza bassa e qualità adattiva sugli spettatori (rete mobile). */
const SYNTHRA_ROOM_OPTIONS: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  audioCaptureDefaults: {
    echoCancellation: true,
    noiseSuppression: true,
  },
  publishDefaults: {
    simulcast: true,
    videoEncoding: VideoPresets.h720.encoding,
    videoSimulcastLayers: [VideoPresets.h360, VideoPresets.h180],
  },
};

type Props = {
  /** roomId restituito dall'API in `/streams/live` o `/streams/public/.../meta`. */
  room: string;
  isLive: boolean;
  /** Password stanza se `needsRoomPassword` dalla meta pubblica. */
  roomPassword?: string | null;
  /** Viewer: chiamato su 403 password errata così il parent può resettare la gate. */
  onRoomGateFailed?: () => void;
  /** true se vogliamo i grant di publish (streamer). Default: viewer. */
  asPublisher?: boolean;
  viewerCount?: number;
  liveLabel?: string;
};

type TokenResponse = { token: string; url: string };

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; token: string; url: string }
  | { kind: "error"; message: string; severity: "info" | "warn" | "error" };

export function LiveKitPlayer({
  room,
  isLive,
  roomPassword,
  onRoomGateFailed,
  asPublisher = false,
  viewerCount,
  liveLabel = "Live",
}: Props) {
  const token = useAppSelector((s) => s.auth.token);
  const [state, setState] = useState<LoadState>({ kind: "idle" });
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      void el.requestFullscreen().catch(() => {});
    } else {
      void document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === stageRef.current);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!isLive) {
      setState({
        kind: "error",
        message: asPublisher
          ? "Avvia la live dallo Studio per iniziare a trasmettere."
          : "Streamer offline.",
        severity: "info",
      });
      return () => {
        cancelled = true;
      };
    }
    if (!token) {
      setState({
        kind: "error",
        message: asPublisher
          ? "Sessione scaduta: rifai login per trasmettere."
          : "Per guardare la live devi accedere.",
        severity: "info",
      });
      return () => {
        cancelled = true;
      };
    }

    setState({ kind: "loading" });

    const run = async () => {
      let res: Response;
      if (asPublisher) {
        res = await apiFetch(
          `/streams/token/streamer?room=${encodeURIComponent(room)}`,
        );
      } else {
        res = await apiFetch("/streams/token/viewer", {
          method: "POST",
          body: JSON.stringify({
            room,
            ...(roomPassword?.trim()
              ? { roomPassword: roomPassword.trim() }
              : {}),
          }),
        });
      }

      const body = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      > & { token?: string; url?: string; message?: string };

      if (cancelled) return;

      if (!res.ok) {
        const code =
          typeof body.message === "string" ? body.message : "";
        if (res.status === 503) {
          setState({
            kind: "error",
            message:
              "LiveKit non e' configurato sull'API (manca LIVEKIT_URL/API_KEY/SECRET).",
            severity: "warn",
          });
          return;
        }
        if (res.status === 403) {
          if (code === "password_room_errata") {
            onRoomGateFailed?.();
            setState({
              kind: "error",
              message: "Password della stanza non valida. Riprova.",
              severity: "warn",
            });
            return;
          }
          if (code.includes("show_privato") || code.includes("pagamento")) {
            setState({
              kind: "error",
              message:
                "Serve lo sblocco ticket (Privato gruppo) nello stato accessi.",
              severity: "warn",
            });
            return;
          }
          if (
            code.includes("show_premium") ||
            code.includes("premium_in_corso")
          ) {
            setState({
              kind: "error",
              message:
                "Show Premium 1v1 riservato: avvia dalla card accessi oppure modalità Spy se disponibile.",
              severity: "warn",
            });
            return;
          }
          setState({
            kind: "error",
            message: code ? code : "Permesso negato per la stanza.",
            severity: "warn",
          });
          return;
        }
        if (res.status === 404) {
          setState({
            kind: "error",
            message: "Live non trovata o terminata.",
            severity: "info",
          });
          return;
        }
        setState({
          kind: "error",
          message: code ? code : `Errore token (${res.status})`,
          severity: "error",
        });
        return;
      }

      const data = body as TokenResponse;
      if (!data.token || !data.url) {
        setState({
          kind: "error",
          message: "Risposta token incompleta.",
          severity: "error",
        });
        return;
      }
      setState({ kind: "ready", token: data.token, url: data.url });
    };

    run().catch((err: unknown) => {
      if (cancelled) return;
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Errore rete",
        severity: "error",
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    room,
    isLive,
    asPublisher,
    token,
    roomPassword,
    onRoomGateFailed,
  ]);

  if (state.kind === "ready") {
    return (
      <div
        ref={stageRef}
        className="group/stage relative h-full w-full overflow-hidden rounded-2xl bg-black"
      >
        <div className="pointer-events-none absolute left-2 top-2 z-[25] flex flex-wrap items-center gap-2 sm:left-3 sm:top-3">
          <span className="inline-flex items-center gap-1.5 rounded bg-red-600 px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-white shadow">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            {liveLabel}
          </span>
          {typeof viewerCount === "number" ? (
            <span className="rounded bg-black/70 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white">
              {formatInteger(viewerCount)} viewer
            </span>
          ) : null}
        </div>

        <LiveKitRoom
          token={state.token}
          serverUrl={state.url}
          connect={true}
          options={SYNTHRA_ROOM_OPTIONS}
          audio={
            asPublisher ? { echoCancellation: true, noiseSuppression: true } : false
          }
          video={
            asPublisher
              ? {
                  resolution: VideoPresets.h720.resolution,
                  facingMode: "user",
                }
              : false
          }
          data-lk-theme="default"
          className="h-full w-full"
        >
          <RoomAudioRenderer />
          <PlayerStage />
          {asPublisher && <ControlBar variation="minimal" />}
          <PlayerChrome
            asPublisher={asPublisher}
            stageRef={stageRef}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
          />
        </LiveKitRoom>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-cam-ink p-6 text-center">
      {state.kind === "loading" && (
        <p className="text-sm text-cam-muted">Connessione alla live…</p>
      )}
      {state.kind === "idle" && (
        <p className="text-sm text-cam-muted">In attesa…</p>
      )}
      {state.kind === "error" && (
        <>
          <p
            className={
              state.severity === "warn"
                ? "text-sm text-amber-300"
                : state.severity === "error"
                  ? "text-sm text-red-300"
                  : "text-sm text-cam-text"
            }
          >
            {state.message}
          </p>
          {!token && (
            <Link
              href="/login"
              className="rounded-full bg-cam-cta px-4 py-2 text-xs font-bold uppercase tracking-wide text-cam-ink"
            >
              Accedi
            </Link>
          )}
        </>
      )}
    </div>
  );
}

function PlayerStage() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  return (
    <GridLayout tracks={tracks} className="h-full w-full">
      <ParticipantTile />
    </GridLayout>
  );
}

type QualityChoice = "auto" | "high" | "medium" | "low";

function PlayerChrome({
  asPublisher,
  stageRef,
  isFullscreen,
  onToggleFullscreen,
}: {
  asPublisher: boolean;
  stageRef: RefObject<HTMLDivElement | null>;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [quality, setQuality] = useState<QualityChoice>("auto");
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: false },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  useEffect(() => {
    const root = stageRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLMediaElement>("audio,video").forEach((el) => {
      el.volume = volume;
      el.muted = muted;
    });
  }, [muted, stageRef, volume]);

  useEffect(() => {
    if (asPublisher || quality === "auto") return;
    const q =
      quality === "high"
        ? VideoQuality.HIGH
        : quality === "medium"
          ? VideoQuality.MEDIUM
          : VideoQuality.LOW;
    for (const track of tracks) {
      const pub = (
        track as unknown as {
          publication?: { setVideoQuality?: (quality: VideoQuality) => void };
        }
      ).publication;
      pub?.setVideoQuality?.(q);
    }
  }, [asPublisher, quality, tracks]);

  return (
    <div className="absolute inset-x-0 bottom-0 z-[30] bg-gradient-to-t from-black/90 via-black/55 to-transparent px-2 pb-2 pt-12 opacity-100 transition lg:opacity-0 lg:focus-within:opacity-100 lg:group-hover/stage:opacity-100">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/55 px-2 py-2 text-white shadow-lg backdrop-blur-md">
        <button
          type="button"
          onClick={() => setMuted((v) => !v)}
          className="touch-target rounded-lg border border-white/15 px-2 text-xs font-bold uppercase tracking-wide hover:bg-white/10"
          aria-pressed={muted}
        >
          {muted || volume === 0 ? "Muto" : "Audio"}
        </button>

        <label className="flex min-w-[140px] flex-1 items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-white/75 sm:max-w-[220px]">
          Volume
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => {
              const next = Number(e.target.value);
              setVolume(next);
              setMuted(next === 0);
            }}
            className="h-2 min-w-0 flex-1 accent-cam-orange"
            aria-label="Volume"
          />
        </label>

        {!asPublisher && (
          <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-white/75">
            Qualità
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value as QualityChoice)}
              className="rounded-md border border-white/15 bg-black/70 px-2 py-1.5 text-xs font-bold text-white outline-none focus:border-cam-orange"
              aria-label="Qualità video"
            >
              <option value="auto">Auto</option>
              <option value="high">720p</option>
              <option value="medium">360p</option>
              <option value="low">180p</option>
            </select>
          </label>
        )}

        <button
          type="button"
          onClick={onToggleFullscreen}
          className="touch-target ml-auto rounded-lg border border-white/15 px-2 text-xs font-bold uppercase tracking-wide hover:bg-white/10"
        >
          {isFullscreen ? "Esci" : "Fullscreen"}
        </button>
      </div>
    </div>
  );
}
