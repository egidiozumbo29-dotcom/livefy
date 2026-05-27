"use client";

import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { CreatorGallery, type GalleryRow } from "@/components/gallery/CreatorGallery";
import { LiveChat } from "@/components/live/LiveChat";
import { LiveKitPlayer } from "@/components/live/LiveKitPlayer";
import { ShowAccessPanel } from "@/components/live/ShowAccessPanel";
import { TipBurst } from "@/components/live/TipBurst";
import { TipLeaderboard } from "@/components/live/TipLeaderboard";
import { TipMenuDialog } from "@/components/live/TipMenuDialog";
import { FollowButton } from "@/components/social/FollowButton";
import { formatInteger } from "@/lib/format";
import { useTrackProfileVisit } from "@/hooks/useTrackProfileVisit";
import { useAppSelector } from "@/store/hooks";

export type PublicMeta = {
  streamerId: string;
  isLive: boolean;
  room: string;
  name: string;
  tags: string[];
  description: string;
  pricePerMinute: number;
  thumbnail: string | null;
  title: string;
  subject?: string;
  country?: string | null;
  language?: string | null;
  gender?: string | null;
  isCouple?: boolean;
  showMode?: "PUBLIC" | "BASE" | "PRIVATE";
  basePrice?: number;
  privatePricePerMinute?: number;
  chatOpen?: boolean;
  tipsTotal?: number;
  /** Richiede password per token LiveKit (non esposto il secret). */
  needsRoomPassword?: boolean;
  stream?: {
    id: string;
    room: string | null;
    title: string;
    viewers: number;
    thumbnail: string | null;
    isPrivate: boolean;
    showMode?: "PUBLIC" | "BASE" | "PRIVATE";
    basePrice?: number;
    privatePricePerMinute?: number;
    spyPricePerMinute?: number;
    chatOpen?: boolean;
    currentPrivateViewerId?: string | null;
    needsRoomPassword?: boolean;
  } | null;
  spyPricePerMinute?: number;
};

/**
 * Estrae tutti i tip goal dai tag (`goal:500`, `cumshow:2000`, ...). Max 5.
 */
function extractTipGoals(
  tags: string[] | undefined | null,
): { goal: number; label: string }[] {
  if (!tags?.length) return [];
  const out: { goal: number; label: string }[] = [];
  for (const raw of tags) {
    const t = raw.trim();
    const goalSimple = /^goal[:_-]?(\d+)$/i.exec(t);
    if (goalSimple) {
      const n = Number(goalSimple[1]);
      if (Number.isFinite(n) && n > 0) {
        out.push({
          goal: n,
          label:
            out.length === 0 ? "Tip goal" : `Tip goal ${out.length + 1}`,
        });
      }
      continue;
    }
    const named = /^([^:]+):(\d+)$/i.exec(t);
    if (named && /goal|obiet|cum|squirt/i.test(named[1])) {
      const n = Number(named[2]);
      if (Number.isFinite(n) && n > 0) {
        out.push({ goal: n, label: named[1].trim() });
      }
    }
  }
  return out.slice(0, 5);
}

type Tab = "bio" | "menu" | "photos" | "videos";

export function LiveRoomClient({
  creatorId,
  meta,
  galleryPhotos,
  galleryVideos,
}: {
  creatorId: string;
  meta: PublicMeta | null;
  galleryPhotos: GalleryRow[];
  galleryVideos: GalleryRow[];
}) {
  const effectiveCreatorId = meta?.streamerId ?? creatorId;
  const me = useAppSelector((s) => s.auth.user);
  useTrackProfileVisit(effectiveCreatorId);

  const title = meta?.title ?? meta?.name ?? creatorId;
  const room = meta?.stream?.room ?? meta?.room ?? `live-${effectiveCreatorId}`;
  const creatorLabel = meta?.name ?? creatorId.slice(0, 8);
  const showMode = meta?.showMode ?? meta?.stream?.showMode ?? "PUBLIC";
  const privateViewerId = meta?.stream?.currentPrivateViewerId ?? null;
  const livePrivatePeerId =
    showMode === "PRIVATE"
      ? me?.id === effectiveCreatorId
        ? privateViewerId
        : privateViewerId === me?.id
          ? effectiveCreatorId
          : null
      : null;
  const basePrice = meta?.basePrice ?? meta?.stream?.basePrice ?? 0;
  const privatePricePerMinute =
    meta?.privatePricePerMinute ??
    meta?.stream?.privatePricePerMinute ??
    0;
  const viewers = meta?.stream?.viewers ?? 0;
  const subject = meta?.subject || meta?.title || "";
  const tipsTotal = meta?.tipsTotal ?? 0;
  const tipGoals = extractTipGoals(meta?.tags);
  const avatar =
    meta?.thumbnail ||
    `https://picsum.photos/seed/${encodeURIComponent(creatorId)}/120/120`;

  const [gateVersion, setGateVersion] = useState(0);
  const [tab, setTab] = useState<Tab>("bio");
  const [tipOpen, setTipOpen] = useState(false);
  const [privatePanelOpen, setPrivatePanelOpen] = useState(false);

  const bumpGate = useCallback(() => {
    setGateVersion((v) => v + 1);
  }, []);

  const needsRoomPassword =
    meta?.needsRoomPassword === true ||
    meta?.stream?.needsRoomPassword === true;

  const roomPwStorageKey = useMemo(
    () => `synthra_roompw:v1:${encodeURIComponent(room)}`,
    [room],
  );

  const [roomPwDraft, setRoomPwDraft] = useState("");
  const [roomPwApplied, setRoomPwApplied] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(roomPwStorageKey);
      const t = stored?.trim();
      if (t && t.length >= 4) {
        setRoomPwApplied(t);
        return;
      }
    } catch {
      /* noop */
    }
    setRoomPwApplied(null);
  }, [roomPwStorageKey]);

  const clearRoomPw = useCallback(() => {
    try {
      sessionStorage.removeItem(roomPwStorageKey);
    } catch {
      /* noop */
    }
    setRoomPwApplied(null);
    setRoomPwDraft("");
    bumpGate();
  }, [roomPwStorageKey, bumpGate]);

  const videoUnlocked =
    !needsRoomPassword ||
    !!(roomPwApplied && roomPwApplied.trim().length >= 4);

  const onRoomGateFailed = useCallback(() => {
    clearRoomPw();
  }, [clearRoomPw]);

  const modeLabel =
    showMode === "BASE"
      ? `Ticket gruppo · ${formatInteger(basePrice)} tk`
      : showMode === "PRIVATE"
        ? `Premium 1v1 · ${formatInteger(privatePricePerMinute)} tk/min`
        : "Pubblico";

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[1600px] flex-1 px-2 py-3 lg:px-4">
        {/* breadcrumb compatta */}
        <nav className="mb-3 flex flex-wrap items-center gap-2 text-[12px] text-cam-muted">
          <Link href="/" className="hover:text-cam-orange-bright">
            ← Live ora
          </Link>
          <span>/</span>
          <Link
            href={`/u/${creatorId}`}
            className="font-medium text-cam-text hover:text-cam-orange-bright"
          >
            {creatorLabel}
          </Link>
        </nav>

        {/* MAIN: video sx + chat dx */}
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* COLONNA SX */}
          <div className="space-y-3">
            {/* Player */}
            <div className="relative overflow-hidden rounded-md border border-cam-border bg-black shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
              <div className="aspect-video w-full">
                {meta?.isLive &&
                needsRoomPassword &&
                !videoUnlocked ? (
                  <div className="flex h-full min-h-[200px] flex-col justify-center gap-3 bg-gradient-to-br from-cam-ink to-black p-6 text-center">
                    <p className="text-sm font-bold text-cam-text">
                      Stanza protetta da password
                    </p>
                    <p className="text-[12px] text-cam-muted">
                      Inserisci la chiave ricevuta dalla creator (live non compare
                      in elenco pubblico).
                    </p>
                    <input
                      type="password"
                      autoComplete="off"
                      value={roomPwDraft}
                      onChange={(e) => setRoomPwDraft(e.target.value)}
                      placeholder="Password stanza · minimo 4 caratteri"
                      className="mx-auto w-full max-w-sm rounded-full border border-cam-border bg-cam-bg px-4 py-2 text-sm text-cam-text"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const t = roomPwDraft.trim();
                        if (t.length < 4) return;
                        try {
                          sessionStorage.setItem(roomPwStorageKey, t);
                        } catch {
                          /* noop */
                        }
                        setRoomPwApplied(t);
                        bumpGate();
                      }}
                      className="mx-auto rounded-full bg-cam-orange px-5 py-2 text-xs font-bold uppercase tracking-wide text-cam-ink"
                    >
                      Sblocca video
                    </button>
                  </div>
                ) : (
                  <LiveKitPlayer
                    key={gateVersion}
                    room={room}
                    isLive={!!meta?.isLive}
                    viewerCount={viewers}
                    liveLabel="Live"
                    roomPassword={
                      needsRoomPassword && roomPwApplied
                        ? roomPwApplied
                        : undefined
                    }
                    onRoomGateFailed={onRoomGateFailed}
                  />
                )}
              </div>

              {needsRoomPassword && meta?.isLive && videoUnlocked ? (
                <button
                  type="button"
                  className="absolute bottom-24 right-3 z-[20] rounded border border-white/25 bg-black/60 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur"
                  onClick={() => clearRoomPw()}
                >
                  Cambia password stanza
                </button>
              ) : null}

              {/* Overlay top-left: live + viewer count */}
              {meta?.isLive && (
                <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded bg-red-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white shadow">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                    Live
                  </span>
                  <span className="rounded bg-black/70 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white">
                    {formatInteger(viewers)} spettatori
                  </span>
                </div>
              )}

              {/* Overlay top-right: mode badge */}
              <span
                className={`absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide shadow ${
                  showMode === "BASE"
                    ? "bg-amber-400 text-amber-950"
                    : showMode === "PRIVATE"
                      ? "bg-cam-orange text-cam-ink"
                      : "bg-cam-card/95 text-cam-text"
                }`}
              >
                {modeLabel}
              </span>

              {/* Subject text overlay (CB-style, sopra gradiente) */}
              {subject && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pb-3 pt-10">
                  <p
                    className="line-clamp-2 text-sm font-medium leading-snug text-white/95 drop-shadow"
                    title={subject}
                  >
                    {subject}
                  </p>
                </div>
              )}

              {/* Tip burst overlay (animazioni quando arrivano tip) */}
              <TipBurst />
            </div>

            {/* Tip Goal progress (multi-goal da tag tipo goal:500, cumshow:2000) */}
            {tipGoals.length > 0 && (
              <div className="space-y-2">
                {tipGoals.map((g) => {
                  const pct = Math.min(
                    100,
                    Math.round((tipsTotal / g.goal) * 100),
                  );
                  return (
                    <div
                      key={`${g.label}-${g.goal}`}
                      className="rounded-md border border-cam-border bg-cam-card p-3 shadow-[0_4px_16px_rgba(0,0,0,0.35)]"
                    >
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="font-bold uppercase tracking-wide text-cam-orange">
                          {g.label}
                        </span>
                        <span className="tabular-nums text-cam-text">
                          <strong className="text-cam-orange-bright">
                            {formatInteger(tipsTotal)}
                          </strong>{" "}
                          / {formatInteger(g.goal)} tk ({pct}%)
                        </span>
                      </div>
                      <div
                        className="h-2.5 w-full overflow-hidden rounded-full bg-cam-ink"
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div
                          className="h-full bg-cam-cta transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                <p className="text-[11px] text-cam-muted">
                  Mancia per far avanzare i goal (stesso saldo tip sulla room).
                </p>
              </div>
            )}

            {/* Card creator + send tip + actions */}
            <div className="rounded-md border border-cam-border bg-cam-card p-4 shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/u/${creatorId}`}
                  className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-cam-border"
                >
                  <Image
                    src={avatar}
                    alt={creatorLabel}
                    fill
                    sizes="56px"
                    className="object-cover"
                    unoptimized
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-lg font-bold text-cam-text">
                    {creatorLabel}
                  </h1>
                  <p className="truncate text-sm text-cam-muted">{title}</p>
                  {meta?.tags && meta.tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {meta.tags.slice(0, 5).map((t) => (
                        <span key={t} className="tag-pill">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTipOpen(true)}
                    className="btn-tip-lg"
                  >
                    ⚡ Send Tip
                  </button>
                  <FollowButton
                    userId={effectiveCreatorId}
                    className="rounded-full border border-cam-border px-3 py-1.5 text-xs font-semibold text-cam-text hover:border-cam-orange hover:text-cam-orange-bright"
                  />
                  {meta?.isLive && (
                    <button
                      type="button"
                      onClick={() => setPrivatePanelOpen((v) => !v)}
                      className="rounded-full border border-cam-orange/60 bg-cam-orange/10 px-3 py-1.5 text-xs font-bold text-cam-orange-bright hover:border-cam-orange-bright"
                    >
                      Private show
                    </button>
                  )}
                  <Link
                    href={`/messages?peer=${encodeURIComponent(effectiveCreatorId)}`}
                    className="rounded-full border border-cam-border px-3 py-1.5 text-xs font-semibold text-cam-text hover:border-cam-orange hover:text-cam-orange-bright"
                  >
                    Messaggio privato
                  </Link>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-cam-muted">
                I messaggi privati verso la modella consumano token per invio,
                finche la modella non ti risponde e sblocca la chat.
              </p>
              {privatePanelOpen && meta?.isLive && (
                <div className="mt-3">
                  <ShowAccessPanel
                    creatorId={effectiveCreatorId}
                    onAccessChange={bumpGate}
                    forcePrivateShow
                  />
                </div>
              )}
            </div>

            {/* Show access panel: solo se la streamer e' in Privato o Premium 1v1 */}
            {meta?.isLive && showMode === "BASE" && (
              <ShowAccessPanel
                creatorId={effectiveCreatorId}
                onAccessChange={bumpGate}
              />
            )}

            {/* Tabs profilo */}
            <div className="rounded-md border border-cam-border bg-cam-card shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
              <div className="flex border-b border-cam-border">
                {[
                  { id: "bio", label: "Bio" },
                  { id: "menu", label: "Tip menu" },
                  { id: "photos", label: "Foto" },
                  { id: "videos", label: "Video" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id as Tab)}
                    className={`relative px-4 py-2.5 text-sm font-semibold transition ${
                      tab === t.id
                        ? "text-cam-orange-bright"
                        : "text-cam-muted hover:text-cam-text"
                    }`}
                  >
                    {t.label}
                    {tab === t.id && (
                      <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-t bg-cam-orange" />
                    )}
                  </button>
                ))}
              </div>
              <div className="px-4 py-3 text-sm text-cam-text">
                {tab === "bio" && (
                  <div className="space-y-2">
                    {meta?.description ? (
                      <p>{meta.description}</p>
                    ) : (
                      <p className="text-cam-muted">
                        Questa creator non ha ancora scritto una bio.
                      </p>
                    )}
                  </div>
                )}
                {tab === "menu" && (
                  <button
                    type="button"
                    onClick={() => setTipOpen(true)}
                    className="text-cam-orange-bright underline"
                  >
                    Apri tip menu →
                  </button>
                )}
                {tab === "photos" && (
                  <CreatorGallery
                    creatorId={creatorId}
                    kind="PHOTO"
                    initialItems={galleryPhotos}
                  />
                )}
                {tab === "videos" && (
                  <CreatorGallery
                    creatorId={creatorId}
                    kind="VIDEO"
                    initialItems={galleryVideos}
                  />
                )}
              </div>
            </div>
          </div>

          {/* COLONNA DX: leaderboard + chat sticky */}
          <aside className="space-y-2 lg:sticky lg:top-16 lg:h-[calc(100dvh-5rem)]">
            <TipLeaderboard streamId={meta?.stream?.id ?? null} />
            <div className="h-full">
              <LiveChat
                roomId={room}
                creatorId={effectiveCreatorId}
                streamId={meta?.stream?.id ?? null}
                showMode={showMode}
                privatePeerId={livePrivatePeerId}
                enforceLogin={!!meta?.isLive}
              />
            </div>
          </aside>
        </div>
      </div>

      <TipMenuDialog
        open={tipOpen}
        creatorId={effectiveCreatorId}
        streamId={meta?.stream?.id ?? null}
        onClose={() => setTipOpen(false)}
      />
    </AppShell>
  );
}
