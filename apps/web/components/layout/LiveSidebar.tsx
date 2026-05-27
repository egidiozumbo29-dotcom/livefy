"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearPersistedAuth } from "@/services/session";
import { logout } from "@/store/slices/authSlice";
import { formatInteger } from "@/lib/format";
import { fetchLiveStreams } from "@/services/live-streams";
import type { ModelCardProps } from "@/components/live/ModelCard";

export function LiveSidebar() {
  const tNav = useTranslations("nav");
  const tSb = useTranslations("liveSidebar");
  const pathname = usePathname();
  const user = useAppSelector((s) => s.auth.user);
  const [clientAuthReady, setClientAuthReady] = useState(false);
  const authUser = clientAuthReady ? user : null;
  useEffect(() => {
    setClientAuthReady(true);
  }, []);

  const nav = useMemo(() => {
    const base = [
      { href: "/", label: tSb("liveNow") },
      { href: "/discover", label: tNav("discover") },
      { href: "/messages", label: tNav("messages") },
      { href: "/wallet", label: tNav("walletMenu") },
      { href: "/profile", label: tNav("profile") },
    ] as const;
    const roleNav =
      authUser?.role === "ADMIN"
        ? { href: "/admin/payouts", label: "Admin" }
        : authUser?.role === "MODERATOR"
          ? { href: "/studio", label: "Moderazione" }
          : authUser?.role === "MODEL"
            ? { href: "/studio", label: tNav("studio") }
            : null;
    return roleNav ? [...base, roleNav] : base;
  }, [tNav, tSb, authUser?.role]);

  const dispatch = useAppDispatch();
  const [online, setOnline] = useState<ModelCardProps[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchLiveStreams()
      .then((rows) => {
        if (!cancelled) setOnline(rows.slice(0, 8));
      })
      .catch(() => {
        if (!cancelled) setOnline([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleLogout() {
    clearPersistedAuth();
    dispatch(logout());
  }

  return (
    <aside className="z-20 flex w-full shrink-0 flex-col border-b border-zinc-800/80 bg-ink/90 backdrop-blur-xl lg:w-72 lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between gap-3 px-4 py-4 lg:flex-col lg:items-stretch lg:px-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cam-orange-bright to-cam-orange shadow-lg shadow-[0_0_20px_rgba(255,140,0,0.28)]">
            <span className="text-sm font-bold text-white">L</span>
          </span>
          <div>
            <p className="text-sm font-semibold tracking-tight text-white">
              Synthra
            </p>
            <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              {tSb("brandSubtitle")}
            </p>
          </div>
        </Link>
        <div className="flex flex-wrap items-center gap-2 lg:w-full">
          {authUser ? (
            <>
              <Link
                href="/profile"
                className="max-w-[140px] truncate rounded-xl border border-zinc-700/80 bg-zinc-900/60 px-3 py-2 text-xs font-medium text-zinc-200 hover:border-cam-orange/50"
              >
                {authUser.username}
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl border border-zinc-700/80 px-3 py-2 text-xs text-zinc-400 transition hover:text-white"
              >
                {tNav("logout")}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-xl border border-zinc-700/80 bg-zinc-900/60 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-cam-orange/50 hover:text-white"
              >
                {tNav("login")}
              </Link>
              <Link
                href="/register"
                className="rounded-xl bg-gradient-to-r from-cam-orange-bright to-cam-orange px-3 py-2 text-xs font-semibold text-cam-ink shadow-md shadow-[0_0_16px_rgba(255,140,0,0.25)] transition hover:opacity-95"
              >
                {tNav("register")}
              </Link>
            </>
          )}
        </div>
      </div>

      <nav className="hidden gap-1 px-3 pb-2 lg:flex lg:flex-col">
        {nav.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/" || pathname === ""
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? "bg-zinc-800/80 font-medium text-white"
                  : "text-zinc-400 hover:bg-zinc-800/60 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800/80 px-3 py-3">
        <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          {tSb("liveNow")}
        </p>
        <ul className="live-scroll flex max-h-40 gap-2 overflow-x-auto pb-1 lg:max-h-none lg:flex-col lg:overflow-visible">
          {online === null ? (
            <li className="px-2 py-2 text-xs text-zinc-500">{tSb("loading")}</li>
          ) : online.length === 0 ? (
            <li className="px-2 py-2 text-xs text-zinc-500">
              {tSb("noStreams")}
              <Link href="/discover" className="text-cam-orange-bright hover:underline">
                {tSb("noStreamsDiscover")}
              </Link>
            </li>
          ) : (
            online.map((m, i) => (
              <motion.li
                key={m.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  href={`/live/${m.id}`}
                  className="flex min-w-[140px] items-center justify-between rounded-xl border border-zinc-800/90 bg-zinc-900/40 px-3 py-2 transition hover:border-cam-orange/35 hover:bg-zinc-900/70 lg:min-w-0"
                >
                  <span className="flex items-center gap-2">
                    <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-medium text-zinc-200">
                      {m.name.slice(0, 2)}
                      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-zinc-900 bg-emerald-500" />
                    </span>
                    <span className="text-sm text-zinc-200">{m.name}</span>
                  </span>
                  <span className="text-[11px] tabular-nums text-zinc-500">
                    {formatInteger(m.viewers)}
                  </span>
                </Link>
              </motion.li>
            ))
          )}
        </ul>
      </div>
    </aside>
  );
}
