"use client";

import { Link } from "@/i18n/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { LiveControls, type LiveState } from "@/components/studio/LiveControls";
import { GalleryEditor } from "@/components/studio/GalleryEditor";
import { TipMenuEditor } from "@/components/studio/TipMenuEditor";
import { CreatorAnalytics } from "@/components/studio/CreatorAnalytics";
import { PayoutPanel } from "@/components/studio/PayoutPanel";
import { ModerationPanel } from "@/components/studio/ModerationPanel";
import { apiFetch } from "@/services/api";
import { useAppSelector } from "@/store/hooks";

type Tab = "live" | "tipmenu" | "gallery" | "analytics" | "moderation" | "payout";

const TABS: { id: Tab; label: string }[] = [
  { id: "live", label: "Live" },
  { id: "tipmenu", label: "Tip menu" },
  { id: "gallery", label: "Galleria" },
  { id: "analytics", label: "Analytics" },
  { id: "moderation", label: "Moderazione" },
  { id: "payout", label: "Payout" },
];

export function StudioClient() {
  const token = useAppSelector((s) => s.auth.token);
  const user = useAppSelector((s) => s.auth.user);
  const [tab, setTab] = useState<Tab>("live");

  const [live, setLive] = useState<LiveState | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) return;
    if (user?.role === "MODERATOR") {
      setLive(null);
      setLoadErr(null);
      return;
    }
    setLoading(true);
    setLoadErr(null);
    try {
      const res = await apiFetch("/streams/me");
      if (res.status === 403) {
        setLoadErr("Solo gli utenti con ruolo MODEL possono usare lo studio.");
        setLive(null);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setLoadErr(
          typeof body.message === "string"
            ? body.message
            : `Errore ${res.status}`,
        );
        return;
      }
      const data = (await res.json()) as { live: LiveState | null };
      setLive(data.live);
    } finally {
      setLoading(false);
    }
  }, [token, user?.role]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isCreator = useMemo(
    () => user?.role === "MODEL" || user?.role === "ADMIN",
    [user?.role],
  );
  const isModerator = user?.role === "MODERATOR";
  const canUseStudio = isCreator || isModerator;
  const visibleTabs = useMemo(() => {
    if (isModerator) {
      return TABS.filter((t) => t.id === "moderation");
    }
    return TABS;
  }, [isModerator]);

  useEffect(() => {
    if (isModerator) {
      setTab("moderation");
    }
  }, [isModerator]);

  if (!token) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl px-4 py-10 lg:px-6">
          <h1 className="text-2xl font-bold text-cam-text">Studio</h1>
          <p className="mt-2 text-sm text-cam-muted">
            Devi prima{" "}
            <Link href="/login" className="font-semibold text-cam-orange-bright hover:underline">
              accedere
            </Link>{" "}
            con un account creator.
          </p>
        </div>
      </AppShell>
    );
  }

  if (!canUseStudio) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl px-4 py-10 lg:px-6">
          <h1 className="text-2xl font-bold text-cam-text">Studio</h1>
          <p className="mt-3 rounded-md border border-amber-500/40 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
            Il tuo account ha ruolo <code>{user?.role}</code>. Per usare lo
            studio serve il ruolo CREATOR o MODERATOR.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="tablet-container py-4 sm:py-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cam-orange-bright">
              Dashboard streamer
            </p>
            <h1 className="mt-1 text-2xl font-bold text-cam-text">Studio</h1>
            <p className="mt-1 text-sm text-cam-muted">
              Gestisci la trasmissione dal browser o da OBS, il tip menu, la
              galleria e le statistiche. L&apos;URL{" "}
              <code className="rounded bg-cam-card px-1 py-0.5 text-[13px]">/dashboard</code>{" "}
              reindirizza qui.
            </p>
          </div>
          {isCreator ? (
            <Link
              href={`/u/${user?.id}`}
              className="rounded-full border border-cam-border px-4 py-2 text-xs font-semibold text-cam-muted hover:border-cam-orange hover:text-cam-orange-bright"
            >
              Vai al profilo pubblico
            </Link>
          ) : null}
        </header>

        <nav
          className="no-scrollbar mt-6 flex gap-1 overflow-x-auto border-b border-cam-border"
          role="tablist"
          aria-label="Sezioni studio"
        >
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              onClick={() => setTab(t.id)}
              aria-selected={tab === t.id}
              className={`relative -mb-px shrink-0 px-4 py-3 text-sm font-bold uppercase tracking-wide transition sm:py-2.5 ${
                tab === t.id
                  ? "text-cam-orange-bright"
                  : "text-cam-muted hover:text-cam-text"
              }`}
            >
              {t.label}
              {tab === t.id && (
                <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-t bg-cam-cta" />
              )}
            </button>
          ))}
        </nav>

        {loadErr && (
          <p className="mt-6 rounded-md border border-amber-500/40 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
            {loadErr}
          </p>
        )}

        <div className="mt-6">
          {tab === "live" && isCreator && (
            <LiveControls live={live} loading={loading} onChange={refresh} />
          )}
          {tab === "tipmenu" && isCreator && <TipMenuEditor userId={user?.id ?? ""} />}
          {tab === "gallery" && isCreator && <GalleryEditor />}
          {tab === "analytics" && isCreator && <CreatorAnalytics />}
          {tab === "moderation" && <ModerationPanel />}
          {tab === "payout" && isCreator && <PayoutPanel />}
        </div>
      </div>
    </AppShell>
  );
}
