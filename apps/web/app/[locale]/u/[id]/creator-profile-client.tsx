"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { CreatorGallery, type GalleryRow } from "@/components/gallery/CreatorGallery";
import { FollowButton } from "@/components/social/FollowButton";
import { formatInteger } from "@/lib/format";
import { useTrackProfileVisit } from "@/hooks/useTrackProfileVisit";
import {
  PROFILE_SOCIAL_KEYS,
  type ProfileSocialKey,
} from "@/lib/social-profile";

export type PublicProfile = {
  id: string;
  username: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string;
  category: string | null;
  tags: string[];
  language: string | null;
  /** Lingue unite (primaria + aggiuntive), pronte da mostrare. */
  languages: string[];
  country: string | null;
  role: string;
  gender: string | null;
  isCouple: boolean;
  privateShowPrice: number | null;
  followers: number;
  isLive: boolean;
  /** Presenza sulla piattaforma (navigazione / ping ~6min). Live ⇒ sempre online. */
  isOnline: boolean;
  socialLinks?: Partial<Record<ProfileSocialKey, string>>;
  stream: {
    id: string;
    room: string | null;
    title: string;
    viewers: number;
    thumbnail: string | null;
    isPrivate: boolean;
  } | null;
};

export type TipMenuItem = {
  id: string;
  label: string;
  tokenCost: number;
  sortOrder: number;
};

export function CreatorProfileClient({
  profile,
  tipMenu,
  galleryPhotos,
  galleryVideos,
}: {
  profile: PublicProfile;
  tipMenu: TipMenuItem[];
  galleryPhotos: GalleryRow[];
  galleryVideos: GalleryRow[];
}) {
  useTrackProfileVisit(profile.id);

  const t = useTranslations("creatorProfile");
  const tSoc = useTranslations("creatorProfile.socialBrand");
  const banner =
    profile.bannerUrl ||
    `https://picsum.photos/seed/${encodeURIComponent(profile.id)}-banner/1600/400`;
  const avatar =
    profile.avatarUrl ||
    `https://picsum.photos/seed/${encodeURIComponent(profile.id)}/160/160`;

  const langs =
    profile.languages?.length > 0
      ? profile.languages
      : profile.language
        ? [profile.language]
        : [];

  const social = profile.socialLinks ?? {};
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[1200px] pb-10">
        <div className="relative h-44 overflow-hidden bg-cam-ink sm:h-56">
          <Image
            src={banner}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
            unoptimized
          />
        </div>

        <div className="px-4 lg:px-6">
          <header className="-mt-12 flex flex-wrap items-end gap-4 sm:-mt-16">
            <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-cam-bg bg-cam-card shadow-lg sm:h-28 sm:w-28">
              <Image
                src={avatar}
                alt={profile.username}
                fill
                sizes="120px"
                className="object-cover"
                unoptimized
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-cam-text">
                  {profile.username}
                </h1>
                {profile.isLive && (
                  <span className="rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Live
                  </span>
                )}
                {!profile.isLive &&
                  (profile.isOnline ? (
                    <span className="flex items-center gap-1 rounded border border-emerald-500/50 bg-emerald-950/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_theme(colors.emerald.400)]" />
                      {t("onlineNow")}
                    </span>
                  ) : (
                    <span className="rounded border border-cam-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cam-muted">
                      {t("offlineNow")}
                    </span>
                  ))}
                <span className="rounded-md border border-cam-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-cam-muted">
                  {profile.role}
                </span>
              </div>
              <p className="mt-1 text-xs text-cam-muted">
                {profile.category ?? t("defaultCategory")}
                {profile.country ? ` · ${profile.country}` : ""}
                {langs.length > 0 ? ` · ${langs.join(" · ")}` : ""}
                {profile.gender ? ` · ${profile.gender}` : ""}
                {profile.isCouple ? ` · ${t("coupleBadge")}` : ""}
              </p>
              <p className="mt-2 flex flex-wrap gap-3 text-xs text-cam-muted">
                <span>
                  <strong className="tabular-nums text-cam-text">
                    {formatInteger(profile.followers)}
                  </strong>{" "}
                  {t("followers")}
                </span>
                {profile.stream && (
                  <span>
                    <strong className="tabular-nums text-cam-text">
                      {formatInteger(profile.stream.viewers)}
                    </strong>{" "}
                    {t("liveViewersNow")}
                  </span>
                )}
                {profile.privateShowPrice != null && (
                  <span>
                    <strong className="tabular-nums text-cam-orange-bright">
                      {formatInteger(profile.privateShowPrice)}
                    </strong>{" "}
                    {t("privateTkPerMin")}
                  </span>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {profile.isLive && (
                <Link
                  href={`/live/${profile.id}`}
                  className="rounded-full bg-cam-cta px-4 py-2 text-xs font-bold uppercase tracking-wide text-cam-ink shadow"
                >
                  {t("enterLive")}
                </Link>
              )}
              <Link
                href={`/messages?peer=${encodeURIComponent(profile.id)}`}
                className="rounded-full border border-cam-border px-4 py-2 text-xs font-semibold text-cam-muted hover:border-cam-orange hover:text-cam-orange-bright"
              >
                {t("message")}
              </Link>
              <FollowButton userId={profile.id} />
            </div>
          </header>

          <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
            <section className="rounded-md border border-cam-border bg-cam-card p-5 shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
              <h2 className="text-sm font-bold uppercase tracking-wider text-cam-muted">
                {t("bioHeading")}
              </h2>
              <p className="mt-3 whitespace-pre-line text-sm text-cam-text">
                {profile.bio?.trim()
                  ? profile.bio
                  : t("noBio")}
              </p>

              {(langs.length > 0 || Object.keys(social).length > 0) && (
                <div className="mt-5 flex flex-col gap-3 border-t border-cam-border pt-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                  {langs.length > 0 ? (
                    <div className="min-w-0">
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-cam-muted">
                        {t("languagesHeading")}
                      </h3>
                      <p className="mt-1 text-sm text-cam-text">{langs.join(", ")}</p>
                    </div>
                  ) : null}
                  {PROFILE_SOCIAL_KEYS.some((k) => social[k]) ? (
                    <div className="min-w-0 flex-1 sm:text-right">
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-cam-muted sm:text-right">
                        {t("socialHeading")}
                      </h3>
                      <div className="mt-2 flex flex-wrap gap-2 sm:justify-end">
                        {PROFILE_SOCIAL_KEYS.map((key) => {
                          const href = social[key];
                          if (!href) return null;
                          return (
                            <a
                              key={key}
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-full border border-cam-orange/40 bg-cam-orange/10 px-3 py-1 text-[11px] font-semibold text-cam-orange-bright transition hover:border-cam-orange hover:bg-cam-orange/20"
                            >
                              {tSoc(key)}
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {profile.tags?.length > 0 && (
                <div className="mt-5">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-cam-muted">
                    {t("tagsHeading")}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {profile.tags.map((t) => (
                      <span key={t} className="tag-pill">
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <aside className="space-y-4">
              {profile.stream && (
                <div className="rounded-md border border-cam-orange/45 bg-gradient-to-br from-cam-card to-cam-ink p-5 shadow-[0_4px_24px_rgba(255,140,0,0.12)]">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-cam-orange-bright">
                    {t("liveNowHeading")}
                  </h2>
                  <p className="mt-3 text-sm font-bold text-cam-text">
                    {profile.stream.title || t("liveSessionFallback")}
                  </p>
                  <p className="mt-1 text-xs text-cam-muted">
                    {formatInteger(profile.stream.viewers)} {t("viewers")} ·{" "}
                    {profile.stream.isPrivate ? t("privateRoom") : t("publicRoom")}
                  </p>
                  <Link
                    href={`/live/${profile.id}`}
                    className="mt-4 inline-block rounded-full bg-cam-cta px-4 py-2 text-xs font-bold uppercase tracking-wide text-cam-ink shadow"
                  >
                    {t("watchNow")}
                  </Link>
                </div>
              )}

              <div className="rounded-md border border-cam-border bg-cam-card p-5 shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
                <h2 className="text-sm font-bold uppercase tracking-wider text-cam-muted">
                  {t("tipMenuHeading")}
                </h2>
                {tipMenu.length === 0 ? (
                  <p className="mt-3 text-xs text-cam-muted">
                    {t("tipEmpty")}
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {tipMenu.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between rounded-md border border-cam-border bg-cam-ink px-3 py-2 text-sm text-cam-text"
                      >
                        <span className="truncate">{item.label}</span>
                        <span className="rounded-full border border-cam-orange/35 bg-cam-orange/15 px-2 py-0.5 tabular-nums font-bold text-cam-orange-bright">
                          {formatInteger(item.tokenCost)} tk
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-[11px] text-cam-muted">
                  {t("tipFooter")}
                </p>
              </div>
            </aside>
          </div>

          <section className="mt-10 space-y-8">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-cam-muted">
                {t("photosHeading")}
              </h2>
              <div className="mt-3">
                <CreatorGallery
                  creatorId={profile.id}
                  kind="PHOTO"
                  initialItems={galleryPhotos}
                />
              </div>
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-cam-muted">
                {t("videosHeading")}
              </h2>
              <div className="mt-3">
                <CreatorGallery
                  creatorId={profile.id}
                  kind="VIDEO"
                  initialItems={galleryVideos}
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
