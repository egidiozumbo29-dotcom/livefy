"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { apiFetch } from "@/services/api";

type Payload = {
  creatorId?: string;
  peerId?: string;
  streamId?: string;
} | null;

type NotifItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  payload: unknown;
  read: boolean;
  createdAt: string;
};

export function NotificationBell() {
  const t = useTranslations("notifications");
  const [items, setItems] = useState<NotifItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch("/notifications?take=30");
    if (!res.ok) return;
    const data = (await res.json()) as {
      unreadCount?: number;
      items?: NotifItem[];
    };
    setItems(data.items ?? []);
    setUnread(typeof data.unreadCount === "number" ? data.unreadCount : 0);
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 75_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    function docClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", docClick);
    return () => document.removeEventListener("mousedown", docClick);
  }, [open]);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      try {
        await load();
      } finally {
        setLoading(false);
      }
    }
  }

  async function markAllRead() {
    await apiFetch("/notifications/read-all", { method: "PATCH" });
    await load();
  }

  function hrefFor(n: NotifItem): string {
    const payload = (n.payload && typeof n.payload === "object"
      ? n.payload
      : null) as Payload;
    const creatorId = typeof payload?.creatorId === "string" ? payload.creatorId : null;
    const peerId = typeof payload?.peerId === "string" ? payload.peerId : null;
    if (n.type === "DIRECT_MESSAGE" && peerId) {
      return `/messages?peer=${encodeURIComponent(peerId)}`;
    }
    if (n.type === "CREATOR_LIVE" && creatorId && payload?.streamId) {
      return `/live/${creatorId}`;
    }
    if (creatorId) return `/u/${creatorId}`;
    return "/discover";
  }

  async function onRowClick(id: string) {
    await apiFetch(`/notifications/${encodeURIComponent(id)}/read`, {
      method: "PATCH",
    }).catch(() => {
      /* no-op */
    });
    await load();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => void toggleOpen()}
        className="relative flex h-9 w-9 items-center justify-center rounded border border-cam-border bg-cam-card text-cam-muted hover:border-cam-orange/50 hover:text-cam-orange-bright"
        aria-label={t("bellAria")}
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6V11c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5S11 3.17 11 4v.68C8.13 5.36 6.47 7.93 6.47 11v5l-2 2v1h17v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z" />
        </svg>
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-[5px] text-[10px] font-black text-white shadow">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,360px)] overflow-hidden rounded border border-cam-border bg-cam-sidebar shadow-xl shadow-black/70">
          <div className="flex items-center justify-between border-b border-cam-border px-3 py-2">
            <p className="text-xs font-bold uppercase tracking-wide text-cam-muted">
              {t("heading")}
            </p>
            <button
              type="button"
              disabled={loading || unread === 0}
              onClick={() => void markAllRead()}
              className="text-[11px] font-semibold uppercase tracking-wide text-cam-orange-bright underline-offset-2 hover:underline disabled:opacity-40"
            >
              {t("markAllRead")}
            </button>
          </div>
          <ul className="max-h-[min(70vh,420px)] overflow-y-auto py-2">
            {loading && items.length === 0 ? (
              <li className="px-4 py-6 text-center text-xs text-cam-muted">{t("loading")}</li>
            ) : null}
            {!loading && items.length === 0 ? (
              <li className="px-4 py-6 text-center text-xs text-cam-muted">
                {t("empty")}
              </li>
            ) : null}
            {items.map((n) => {
              const href = hrefFor(n);
              const isLive = n.type === "CREATOR_LIVE";
              const isDm = n.type === "DIRECT_MESSAGE";
              return (
                <li key={n.id}>
                  <Link
                    href={href}
                    onClick={() => void onRowClick(n.id)}
                    className={`flex gap-3 px-3 py-2.5 text-left transition hover:bg-cam-card ${
                      !n.read ? "bg-cam-orange/5" : ""
                    }`}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cam-border bg-gradient-to-br from-cam-orange/25 to-cam-ink font-black text-sm text-cam-orange-bright">
                      {(n.title || "?").slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-cam-text">{n.title}</p>
                      {n.body ? (
                        <p className="truncate text-xs text-cam-muted">{n.body}</p>
                      ) : null}
                      <div className="mt-1 flex flex-wrap gap-2">
                        <span className="text-[10px] uppercase tracking-wide text-cam-muted">
                          {new Date(n.createdAt).toLocaleString()}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white ${
                            isLive
                              ? "bg-red-600"
                              : isDm
                                ? "bg-cam-orange text-cam-ink"
                                : "bg-emerald-700"
                          }`}
                        >
                          {isLive
                            ? t("badgeLive")
                            : isDm
                              ? t("badgeMessage")
                              : t("badgeOnline")}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
