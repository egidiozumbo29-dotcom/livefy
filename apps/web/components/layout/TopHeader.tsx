"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearPersistedAuth } from "@/services/session";
import { logout } from "@/store/slices/authSlice";
import { formatInteger } from "@/lib/format";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { PersonalizedHeaderMenu } from "./PersonalizedHeaderMenu";
import { useUnreadNotificationCount } from "@/hooks/useUnreadNotificationCount";

export function TopHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("nav");
  const tMenu = useTranslations("personalMenu");
  const user = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();
  /** Redux viene aggiornato solo dopo AuthHydrator (client): senza questo SSR ≠ primo hydrate */
  const [clientAuthReady, setClientAuthReady] = useState(false);
  const authUser = clientAuthReady ? user : null;
  useEffect(() => {
    setClientAuthReady(true);
  }, []);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [notifBump, bumpNotifs] = useState(0);
  const headerUnread = useUnreadNotificationCount(
    !!authUser && clientAuthReady,
    notifBump,
  );

  const navLinks = [
    { href: "/", label: t("live") },
    { href: "/discover", label: t("discover") },
    { href: "/messages", label: t("messages") },
    { href: "/wallet", label: t("tokens") },
  ] as const;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  function handleLogout() {
    clearPersistedAuth();
    dispatch(logout());
    setMenuOpen(false);
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    router.push(`/discover?q=${encodeURIComponent(q)}`);
  }

  const isCreator =
    authUser?.role === "MODEL" || authUser?.role === "ADMIN";
  const isModerator = authUser?.role === "MODERATOR";
  const isAdmin = authUser?.role === "ADMIN";
  const staffLabel = isAdmin
    ? "Admin"
    : isModerator
      ? "Moderazione"
      : t("studio");
  const staffHref = isAdmin ? "/admin/payouts" : "/studio";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-cam-border bg-cam-ink text-cam-text shadow-[0_4px_24px_rgba(0,0,0,0.65)]">
      <div className="mx-auto flex h-[52px] max-w-[1920px] items-center gap-3 px-3 sm:gap-4 sm:px-4 lg:px-6">
        <Link
          href="/"
          className="flex shrink-0 flex-col gap-0 leading-none sm:flex-row sm:items-baseline sm:gap-2"
        >
          <span className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded border border-cam-orange/40 bg-gradient-to-b from-cam-orange-bright to-cam-orange text-sm font-black text-cam-ink shadow-[0_0_20px_rgba(255,140,0,0.25)]">
              S
            </span>
            <span className="hidden text-lg font-black tracking-tight text-cam-text sm:inline">
              SYNTHRA
            </span>
          </span>
          <span className="pl-[44px] text-[9px] font-bold uppercase tracking-[0.2em] text-cam-orange sm:pl-0 sm:text-[10px]">
            {t("taglineShort")}
          </span>
        </Link>

        <Link
          href={isCreator || isModerator || isAdmin ? staffHref : "/register"}
          className="hidden shrink-0 items-center justify-center rounded border border-cam-orange/60 bg-cam-cta px-3 py-1.5 text-center text-[11px] font-black uppercase tracking-wide text-cam-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] sm:inline-flex"
        >
          {isCreator || isModerator || isAdmin ? staffLabel : t("broadcastCta")}
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex">
          {navLinks.map((l) => {
            const active =
              l.href === "/"
                ? pathname === "/"
                : pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded px-2.5 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-cam-orange/15 text-cam-orange-bright"
                    : "text-cam-muted hover:bg-cam-card hover:text-cam-text"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          {authUser ? (
            <>
              <Link
                href="/favorites"
                className={`rounded px-2.5 py-1.5 text-sm font-medium transition ${
                  pathname.includes("/favorites")
                    ? "bg-cam-orange/15 text-cam-orange-bright"
                    : "text-cam-muted hover:bg-cam-card hover:text-cam-text"
                }`}
              >
                {t("favorites")}
              </Link>
              <Link
                href="/history"
                className={`rounded px-2.5 py-1.5 text-sm font-medium transition ${
                  pathname.includes("/history")
                    ? "bg-cam-orange/15 text-cam-orange-bright"
                    : "text-cam-muted hover:bg-cam-card hover:text-cam-text"
                }`}
              >
                {t("history")}
              </Link>
            </>
          ) : null}
          {(isCreator || isModerator) && (
            <Link
              href="/studio"
              className={`rounded px-2.5 py-1.5 text-sm font-bold transition ${
                pathname.startsWith("/studio")
                  ? "bg-cam-orange text-cam-ink"
                  : "text-cam-orange-bright hover:bg-cam-orange/10"
              }`}
            >
              {isModerator ? "Moderazione" : t("studio")}
            </Link>
          )}
          {isAdmin && (
            <Link
              href="/admin/payouts"
              className={`rounded px-2.5 py-1.5 text-sm font-bold transition ${
                pathname.startsWith("/admin")
                  ? "bg-cam-orange text-cam-ink"
                  : "text-cam-orange-bright hover:bg-cam-orange/10"
              }`}
            >
              Admin
            </Link>
          )}
        </nav>

        <form
          onSubmit={onSearch}
          className="ml-auto flex min-w-0 flex-1 items-center sm:max-w-md lg:max-w-lg"
          role="search"
        >
          <div className="relative w-full">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full rounded border border-cam-border bg-cam-card py-2 pl-9 pr-3 text-sm text-cam-text placeholder:text-cam-muted focus:border-cam-orange focus:outline-none focus:ring-1 focus:ring-cam-orange"
            />
            <svg
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cam-muted"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </div>
        </form>

        <div className="hidden shrink-0 sm:block lg:mr-1">
          <LocaleSwitcher />
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {authUser ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="relative flex items-center gap-2 rounded border border-cam-border bg-cam-card px-2.5 py-1.5 text-sm text-cam-text hover:border-cam-orange/50"
                aria-label={
                  headerUnread > 0
                    ? tMenu("menuButtonAriaUnread", {
                        count: headerUnread,
                      })
                    : tMenu("menuButtonAria")
                }
              >
                {headerUnread > 0 ? (
                  <span
                    className="absolute -right-1 -top-1 z-[1] flex h-4 min-w-[16px] items-center justify-center rounded-full border-2 border-cam-card bg-red-600 px-[3px] text-[9px] font-black text-white shadow-[0_0_10px_rgba(220,38,38,0.75)] animate-pulse"
                    aria-hidden
                  >
                    {headerUnread > 9 ? "9+" : headerUnread}
                  </span>
                ) : null}
                <span className="hidden tabular-nums text-cam-orange sm:inline">
                  {formatInteger(authUser.balance)} tk
                </span>
                <span className="max-w-[96px] truncate font-medium">
                  {authUser.username}
                </span>
                <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M6 8L2 4h8z" />
                </svg>
              </button>
              <PersonalizedHeaderMenu
                open={menuOpen}
                authUser={authUser}
                isCreator={isCreator}
                pathname={pathname}
                onClose={() => setMenuOpen(false)}
                onLogout={handleLogout}
                onNotifsMutated={() => bumpNotifs((n) => n + 1)}
              />
            </div>
          ) : (
            <>
              <span className="sm:hidden">
                <LocaleSwitcher />
              </span>
              <Link
                href="/login"
                className="rounded border border-cam-border px-2.5 py-1.5 text-xs font-semibold text-cam-muted hover:border-cam-orange hover:text-cam-text sm:text-sm"
              >
                {t("login")}
              </Link>
              <Link
                href="/register"
                className="rounded border border-cam-orange/70 bg-cam-cta px-2.5 py-1.5 text-xs font-black uppercase tracking-wide text-cam-ink shadow sm:text-sm"
              >
                {t("register")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
