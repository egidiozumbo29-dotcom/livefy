"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { apiFetch, apiUrl, fetchWithTimeout } from "@/services/api";
import type { AuthUser } from "@/store/slices/authSlice";
import { FALLBACK_TOKEN_PACKS } from "@/lib/token-packs-fallback";
import { formatInteger } from "@/lib/format";
import { LocaleSwitcher } from "./LocaleSwitcher";

type PackPreview = {
  key: string;
  totalTokens: number;
  cents: number;
  currency: string;
};

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

function hrefForNotif(n: NotifItem): string {
  const payload = (
    n.payload && typeof n.payload === "object" ? n.payload : null
  ) as Payload;
  const creatorId =
    typeof payload?.creatorId === "string" ? payload.creatorId : null;
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

function fallbackPackPreviews(limit = 4): PackPreview[] {
  return FALLBACK_TOKEN_PACKS.slice(0, limit).map((p) => ({
    key: p.key,
    totalTokens: p.tokens + (p.bonusTokens ?? 0),
    cents: p.cents,
    currency: p.currency.toUpperCase(),
  }));
}

async function loadPackPreviews(): Promise<PackPreview[]> {
  try {
    const r = await fetchWithTimeout(apiUrl("/payments/token-packs"));
    if (!r.ok) throw new Error("bad_status");
    const d = (await r.json()) as {
      packs?: {
        key: string;
        tokens?: number;
        bonusTokens?: number;
        totalTokens?: number;
        cents: number;
        currency?: string;
      }[];
    };
    const list = d.packs ?? [];
    if (!list.length) return fallbackPackPreviews();
    return list.slice(0, 4).map((p) => ({
      key: p.key,
      totalTokens:
        typeof p.totalTokens === "number"
          ? p.totalTokens
          : (p.tokens ?? 0) + (p.bonusTokens ?? 0),
      cents: p.cents,
      currency: (p.currency ?? "EUR").toUpperCase(),
    }));
  } catch {
    return fallbackPackPreviews();
  }
}

const notifListVariant = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

const notifItemVariant = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 380, damping: 28 } },
};

type Props = {
  open: boolean;
  authUser: AuthUser;
  isCreator: boolean;
  pathname: string;
  /** Invocato dopo la lettura delle notifiche per aggiornare il badge in header */
  onNotifsMutated?: () => void;
  onClose: () => void;
  onLogout: () => void;
};

export function PersonalizedHeaderMenu({
  open,
  authUser,
  isCreator,
  pathname,
  onNotifsMutated,
  onClose,
  onLogout,
}: Props) {
  const t = useTranslations("personalMenu");
  const tNav = useTranslations("nav");
  const tNt = useTranslations("notifications");

  const [packs, setPacks] = useState<PackPreview[]>([]);
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [notifUnread, setNotifUnread] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);

  const reloadNotifs = useCallback(async () => {
    const res = await apiFetch("/notifications?take=8");
    if (!res.ok) return;
    const data = (await res.json()) as {
      unreadCount?: number;
      items?: NotifItem[];
    };
    setNotifications(data.items ?? []);
    setNotifUnread(
      typeof data.unreadCount === "number" ? data.unreadCount : 0,
    );
    onNotifsMutated?.();
  }, [onNotifsMutated]);

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    (async () => {
      setPreviewLoading(true);
      const [plist] = await Promise.all([
        loadPackPreviews(),
        reloadNotifs(),
      ]);
      if (!cancel) {
        setPacks(plist);
        setPreviewLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [open, reloadNotifs]);

  async function markNotifRowRead(id: string) {
    await apiFetch(`/notifications/${encodeURIComponent(id)}/read`, {
      method: "PATCH",
    }).catch(() => {
      /* no-op */
    });
    await reloadNotifs();
  }

  const moneyFmt = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "EUR",
  });

  function moneyFromCents(cents: number) {
    return moneyFmt.format(cents / 100);
  }

  const isModerator = authUser.role === "MODERATOR";
  const isAdmin = authUser.role === "ADMIN";

  const actions = (
    [
      { href: "/profile", label: tNav("profile") },
      { href: "/wallet", label: tNav("walletMenu") },
      { href: "/messages", label: tNav("messages") },
      { href: "/discover", label: tNav("discover") },
      { href: "/favorites", label: tNav("favorites") },
      { href: "/history", label: tNav("history") },
      ...(isCreator
        ? [{ href: "/studio", label: tNav("studioCreator") } as const]
        : ([] as const)),
      ...(isModerator
        ? [{ href: "/studio", label: "Moderazione" } as const]
        : ([] as const)),
      ...(isAdmin
        ? [{ href: "/admin/payouts", label: "Admin" } as const]
        : ([] as const)),
    ] satisfies { href: string; label: string }[]
  ).map((a) => ({
    ...a,
    active:
      a.href === "/"
        ? pathname === "/"
        : pathname === a.href || pathname.startsWith(`${a.href}/`),
  }));

  const sectionDivider = (
    <div className="my-3 h-px bg-gradient-to-r from-transparent via-cam-border to-transparent" />
  );

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.99 }}
          transition={{ duration: 0.16, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="pointer-events-auto absolute right-0 z-50 mt-2 w-[min(100vw-1rem,400px)] origin-top overflow-hidden rounded-lg border border-cam-border bg-cam-sidebar shadow-2xl shadow-black/75 ring-1 ring-cam-orange/10"
          role="menu"
          aria-label={t("ariaMenu")}
        >
          <div className="cam-menu-shine bg-gradient-to-br from-cam-orange/[0.08] via-transparent to-transparent px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-cam-text">
                  {authUser.username}
                </p>
                <p className="text-[11px] text-cam-muted">
                  {t("balanceLine", {
                    tokens: formatInteger(authUser.balance ?? 0),
                  })}
                  {isCreator &&
                  typeof authUser.creatorBalance === "number" ? (
                    <span className="block text-emerald-400/95">
                      {t("creatorEarningsShort", {
                        tokens: formatInteger(authUser.creatorBalance),
                      })}
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="shrink-0 sm:hidden">
                <LocaleSwitcher />
              </div>
            </div>
          </div>

          <div className="max-h-[min(76vh,520px)] overflow-y-auto px-3 pb-3 pt-2">
            <div>
              <h3 className="mb-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-cam-muted">
                {t("actionsHeading")}
              </h3>
              <nav className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {actions.map((a) => (
                  <Link
                    key={a.href}
                    href={a.href}
                    role="menuitem"
                    onClick={() => onClose()}
                    className={`rounded-md border px-2 py-2 text-center text-[11px] font-semibold leading-tight transition ${
                      a.active
                        ? "border-cam-orange/50 bg-cam-orange/15 text-cam-orange-bright"
                        : "border-cam-border bg-cam-card/80 text-cam-text hover:border-cam-orange/40 hover:bg-cam-card"
                    }`}
                  >
                    {a.label}
                  </Link>
                ))}
              </nav>
            </div>

            {sectionDivider}

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-cam-muted">
                  {t("tokenPricesHeading")}
                </h3>
                <Link
                  href="/wallet"
                  onClick={() => onClose()}
                  className="text-[10px] font-bold uppercase tracking-wide text-cam-orange-bright underline-offset-2 hover:underline"
                >
                  {t("seeWallet")}
                </Link>
              </div>
              {previewLoading && !packs.length ? (
                <div className="flex gap-2">
                  {[0, 1, 2].map((k) => (
                    <div
                      key={k}
                      className="h-12 flex-1 animate-pulse rounded-md bg-cam-border/40"
                    />
                  ))}
                </div>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {packs.map((p, idx) => (
                    <motion.div
                      key={p.key}
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05, duration: 0.18 }}
                      className="min-w-[90px]"
                    >
                      <Link
                        href="/wallet"
                        onClick={() => onClose()}
                        className="flex flex-col rounded-md border border-cam-border bg-gradient-to-br from-cam-orange/18 to-cam-ink px-2 py-1.5 text-center transition hover:border-cam-orange/50"
                      >
                        <span className="font-mono text-[13px] font-black tabular-nums text-cam-orange-bright">
                          {formatInteger(p.totalTokens)}
                        </span>
                        <span className="text-[9px] font-bold uppercase text-cam-muted">
                          tk
                        </span>
                        <span className="mt-0.5 border-t border-cam-border/60 pt-0.5 text-[10px] font-semibold text-cam-text">
                          {moneyFromCents(p.cents)}
                        </span>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {sectionDivider}

            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-cam-muted">
                  {t("notificationsHeading")}
                  {notifUnread > 0 ? (
                    <motion.span
                      layout
                      className="inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-[5px] text-[10px] font-black text-white shadow-[0_0_12px_rgba(220,38,38,0.55)]"
                      animate={{
                        scale: [1, 1.08, 1],
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 2.2,
                        ease: "easeInOut",
                      }}
                    >
                      {notifUnread > 99 ? "99+" : notifUnread}
                    </motion.span>
                  ) : null}
                </h3>
                <button
                  type="button"
                  disabled={notifUnread === 0}
                  onClick={() => {
                    void (async () => {
                      await apiFetch("/notifications/read-all", {
                        method: "PATCH",
                      }).catch(() => {
                        /* no-op */
                      });
                      await reloadNotifs();
                    })();
                  }}
                  className="text-[10px] font-semibold uppercase tracking-wide text-cam-orange-bright underline-offset-2 hover:underline disabled:opacity-35"
                >
                  {tNt("markAllRead")}
                </button>
              </div>
              <motion.ul
                className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border border-cam-border/80 bg-black/25 p-1.5"
                variants={notifListVariant}
                initial="hidden"
                animate="show"
              >
                {notifications.length === 0 ? (
                  <li className="px-2 py-4 text-center text-[11px] text-cam-muted">
                    {tNt("empty")}
                  </li>
                ) : (
                  notifications.slice(0, 6).map((n) => {
                    const href = hrefForNotif(n);
                    const pulse = !n.read;
                    return (
                      <motion.li key={n.id} variants={notifItemVariant}>
                        <Link
                          href={href}
                          onClick={() => void markNotifRowRead(n.id)}
                          role="menuitem"
                          className={`flex gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-cam-card ${
                            pulse ? "bg-cam-orange/[0.12]" : ""
                          }`}
                        >
                          <span
                            className={`relative mt-1 h-2 w-2 shrink-0 rounded-full ${
                              pulse
                                ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.9)]"
                                : "bg-cam-muted/40"
                            }`}
                          >
                            {pulse ? (
                              <motion.span
                                className="absolute inset-0 rounded-full bg-red-400"
                                animate={{ opacity: [0.5, 0, 0.5], scale: [1, 1.6, 1] }}
                                transition={{
                                  repeat: Infinity,
                                  duration: 1.9,
                                  ease: "easeInOut",
                                }}
                              />
                            ) : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-1 text-[12px] font-semibold text-cam-text">
                              {n.title}
                            </span>
                            {n.body ? (
                              <span className="line-clamp-1 text-[10px] text-cam-muted">
                                {n.body}
                              </span>
                            ) : null}
                          </span>
                        </Link>
                      </motion.li>
                    );
                  })
                )}
              </motion.ul>
            </div>

            {sectionDivider}

            <div>
              <h3 className="mb-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-cam-muted">
                {t("premiumHeading")}
              </h3>
              <div className="rounded-md border border-cam-orange/35 bg-gradient-to-r from-purple-950/35 via-cam-card to-pink-950/25 px-2.5 py-2">
                <p className="text-[11px] leading-snug text-cam-text/95">
                  {isCreator ? t("premiumHintCreator") : t("premiumHintViewer")}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link
                    href={isCreator ? "/studio" : "/messages"}
                    onClick={() => onClose()}
                    className="rounded-full bg-cam-cta px-3 py-1 text-[10px] font-black uppercase tracking-wide text-cam-ink"
                  >
                    {isCreator ? t("premiumCtaStudio") : t("premiumCtaInbox")}
                  </Link>
                  <Link
                    href="/discover"
                    onClick={() => onClose()}
                    className="rounded-full border border-cam-border px-3 py-1 text-[10px] font-semibold text-cam-muted hover:border-cam-orange"
                  >
                    {t("premiumCtaBrowse")}
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-cam-border bg-cam-ink px-3 py-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="w-full rounded-md border border-cam-border py-2 text-center text-[12px] font-semibold text-cam-muted transition hover:bg-cam-card hover:text-cam-text"
            >
              {tNav("logout")}
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
