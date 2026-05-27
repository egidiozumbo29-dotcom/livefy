"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link as NavLink } from "@/i18n/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/services/api";
import { useAppSelector } from "@/store/hooks";
import { formatInteger } from "@/lib/format";

type FollowingRow = {
  creatorId: string;
  username: string;
  avatarUrl: string | null;
  category: string | null;
  isLive: boolean;
  streamTitle: string | null;
  viewers: number;
  isOnline: boolean;
};

export default function FavoritesPage() {
  const t = useTranslations("viewerLists");
  const token = useAppSelector((s) => s.auth.token);
  const [items, setItems] = useState<FollowingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    apiFetch("/follow/me/following")
      .then(async (res) => {
        if (!res.ok) throw new Error("load");
        return res.json();
      })
      .then((data: { items?: FollowingRow[] }) => {
        if (!cancelled) setItems(data.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setErr(t("loadError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  if (!token) {
    return (
      <AppShell>
        <div className="mx-auto max-w-xl px-4 py-12 text-center text-sm text-cam-muted">
          {t("loginPrompt")}{" "}
          <NavLink href="/login" className="font-semibold text-cam-orange-bright underline">
            {t("loginCta")}
          </NavLink>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[760px] px-4 py-8">
        <h1 className="text-xl font-bold text-cam-text">{t("favoritesTitle")}</h1>
        <p className="mt-2 text-sm text-cam-muted">{t("favoritesSubtitle")}</p>

        {err ? (
          <p className="mt-6 rounded border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-100">
            {err}
          </p>
        ) : null}

        {loading ? (
          <p className="mt-8 text-center text-xs text-cam-muted">{t("loading")}</p>
        ) : null}

        {!loading && items.length === 0 ? (
          <p className="mt-10 text-center text-sm text-cam-muted">{t("favoritesEmpty")}</p>
        ) : (
          <ul className="mt-6 divide-y divide-cam-border rounded border border-cam-border bg-cam-card">
            {items.map((row) => {
              const img =
                row.avatarUrl ||
                `https://picsum.photos/seed/${encodeURIComponent(row.creatorId)}/96/96`;
              return (
                <li key={row.creatorId}>
                  <div className="flex flex-wrap items-center gap-4 px-4 py-3">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-cam-border">
                      <Image
                        src={img}
                        alt=""
                        fill
                        sizes="56px"
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <NavLink
                          href={`/u/${row.creatorId}`}
                          className="truncate font-bold text-cam-text hover:text-cam-orange-bright"
                        >
                          {row.username}
                        </NavLink>
                        {row.isLive ? (
                          <span className="rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">
                            Live
                          </span>
                        ) : row.isOnline ? (
                          <span className="rounded border border-emerald-500/50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-300">
                            {t("onlineBadge")}
                          </span>
                        ) : null}
                      </div>
                      {row.category ? (
                        <p className="text-xs text-cam-muted">{row.category}</p>
                      ) : null}
                      {row.isLive && row.streamTitle ? (
                        <p className="mt-1 truncate text-xs text-cam-muted">
                          {row.streamTitle} · {formatInteger(row.viewers)}{" "}
                          {t("viewers")}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <NavLink
                        href={`/u/${row.creatorId}`}
                        className="rounded-full border border-cam-border px-3 py-1.5 text-[11px] font-semibold text-cam-muted hover:border-cam-orange hover:text-cam-orange-bright"
                      >
                        {t("profileCta")}
                      </NavLink>
                      {row.isLive ? (
                        <NavLink
                          href={`/live/${row.creatorId}`}
                          className="rounded-full bg-cam-cta px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-cam-ink shadow"
                        >
                          {t("watchLive")}
                        </NavLink>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
