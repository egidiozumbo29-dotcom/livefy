"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { DiscoverShelf } from "@/components/discover/DiscoverShelf";
import { AppShell } from "@/components/layout/AppShell";
import { LiveDirectory } from "@/components/home/LiveDirectory";
import { TagBar } from "@/components/home/TagBar";
import { FollowButton } from "@/components/social/FollowButton";
import type { DiscoverySearchParams } from "@/services/discovery";
import {
  fetchDiscoveryCategories,
  fetchDiscoveryNewModels,
  fetchDiscoveryOnlineModels,
  fetchDiscoveryRecommended,
  fetchDiscoverySearch,
  fetchDiscoveryTrendingLive,
  fetchDiscoveryTopEarners,
  mapDiscoveryCreatorToModelCard,
  type DiscoveryCategory,
  type DiscoverySearchRow,
  type DiscoveryTopEarnerRow,
} from "@/services/discovery";
import type { ModelCardProps } from "@/components/live/ModelCard";
import { formatInteger } from "@/lib/format";

export function DiscoverClient() {
  const t = useTranslations("discover");
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";

  const [tag, setTag] = useState<string | null>(null);

  const [q, setQ] = useState(initialQ);

  const [categories, setCategories] = useState<DiscoveryCategory[]>([]);

  const [onlineModels, setOnlineModels] = useState<ModelCardProps[]>([]);
  const [trending, setTrending] = useState<ModelCardProps[]>([]);
  const [recommended, setRecommended] = useState<ModelCardProps[]>([]);
  const [newModels, setNewModels] = useState<ModelCardProps[]>([]);

  const [topEarnersRaw, setTopEarnersRaw] = useState<DiscoveryTopEarnerRow[]>(
    [],
  );

  const [advCategory, setAdvCategory] = useState("");
  const [advGender, setAdvGender] = useState("");
  const [advCountry, setAdvCountry] = useState("");
  const [advLanguage, setAdvLanguage] = useState("");
  const [advTag, setAdvTag] = useState("");
  const [advCouple, setAdvCouple] = useState(false);
  const [advSort, setAdvSort] = useState<
    NonNullable<DiscoverySearchParams["sort"]>
  >("relevance");
  const [advOpen, setAdvOpen] = useState(false);

  const [results, setResults] = useState<DiscoverySearchRow[] | null>(null);
  const topEarnersShelf = useMemo(
    () =>
      topEarnersRaw.map((r) =>
        mapDiscoveryCreatorToModelCard({
          ...r,
          subjectOverride: t("topEarnerSubject", {
            tokens: formatInteger(r.tipTokens),
          }),
        }),
      ),
    [topEarnersRaw, t],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [cat, onl, trend, reco, neu, tops] = await Promise.all([
        fetchDiscoveryCategories(),
        fetchDiscoveryOnlineModels(24),
        fetchDiscoveryTrendingLive(28),
        fetchDiscoveryRecommended(18),
        fetchDiscoveryNewModels(18),
        fetchDiscoveryTopEarners(15, 30),
      ]);
      if (cancelled) return;
      setCategories(cat);
      setOnlineModels(onl);
      setTrending(trend);
      setRecommended(reco);
      setNewModels(neu);
      setTopEarnersRaw(tops);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runSearch = useCallback(
    async (extra?: Partial<DiscoverySearchParams>) => {
      const trimmed = q.trim();
      const params: DiscoverySearchParams = {
        q: trimmed.length >= 2 ? trimmed : undefined,
        category: advCategory.trim() || undefined,
        gender: advGender.trim() || undefined,
        country: advCountry.trim() || undefined,
        language: advLanguage.trim() || undefined,
        tag: advTag.trim() || undefined,
        coupleOnly: advCouple || undefined,
        sort: advSort,
        take: 36,
        ...extra,
      };
      try {
        const items = await fetchDiscoverySearch(params);
        setResults(items);
      } catch {
        setResults([]);
      }
    },
    [
      q,
      advCategory,
      advGender,
      advCountry,
      advLanguage,
      advTag,
      advCouple,
      advSort,
    ],
  );

  function clearAdvanced() {
    setAdvCategory("");
    setAdvGender("");
    setAdvCountry("");
    setAdvLanguage("");
    setAdvTag("");
    setAdvCouple(false);
    setAdvSort("relevance");
  }

  function clearAllFilters() {
    clearAdvanced();
    setQ("");
    setResults(null);
  }

  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length < 2) return;
    const timer = setTimeout(() => {
      void runSearch();
    }, 320);
    return () => clearTimeout(timer);
  }, [q, runSearch]);

  return (
    <AppShell>
      <div className="tablet-container max-w-[1600px] py-4 sm:py-6">
        <header className="mb-4">
          <h1 className="text-xl font-bold text-cam-text">{t("title")}</h1>
          <p className="mt-1 max-w-xl text-sm text-cam-muted">{t("subtitle")}</p>
          <div className="mt-3 flex max-w-xl flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="form-input min-w-0 flex-1 rounded-full"
            />
            <button
              type="button"
              className="touch-target rounded-full border border-cam-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-cam-muted hover:border-cam-orange hover:text-cam-orange"
              onClick={() => setAdvOpen((o) => !o)}
              aria-expanded={advOpen}
            >
              {t("advancedToggle")}
            </button>
          </div>
        </header>

        <section
          className="mb-8 rounded-md border border-cam-border bg-cam-card p-4 shadow-[0_4px_20px_rgba(0,0,0,0.35)]"
          aria-labelledby="discover-filter-bar-title"
        >
          <h2
            id="discover-filter-bar-title"
            className="mb-3 text-xs font-semibold uppercase tracking-wider text-cam-muted"
          >
            {t("filterBarTitle")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <label className="block min-w-0 text-[11px] font-semibold text-cam-muted">
              <span>{t("dimLanguage")}</span>
              <input
                type="text"
                value={advLanguage}
                onChange={(e) => setAdvLanguage(e.target.value)}
                placeholder={t("dimLanguagePlaceholder")}
                list="discover-lang-presets"
                className="form-input mt-1 w-full"
                autoComplete="off"
              />
            </label>
            <label className="block min-w-0 text-[11px] font-semibold text-cam-muted">
              <span>{t("dimCountry")}</span>
              <input
                type="text"
                value={advCountry}
                onChange={(e) => setAdvCountry(e.target.value)}
                placeholder={t("filterCountryPlaceholder")}
                list="discover-country-presets"
                className="form-input mt-1 w-full"
                autoComplete="off"
              />
            </label>
            <label className="block min-w-0 text-[11px] font-semibold text-cam-muted sm:col-span-2 xl:col-span-1 2xl:col-span-1">
              <span>{t("dimCategory")}</span>
              <select
                className="form-input mt-1 w-full"
                value={advCategory}
                onChange={(e) => setAdvCategory(e.target.value)}
              >
                <option value="">{t("dimCategoryAny")}</option>
                {categories.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({formatInteger(c.count)})
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-0 text-[11px] font-semibold text-cam-muted">
              <span>{t("dimTag")}</span>
              <input
                type="text"
                value={advTag}
                onChange={(e) => setAdvTag(e.target.value)}
                placeholder={t("dimTagPlaceholder")}
                className="form-input mt-1 w-full"
              />
            </label>
            <label className="block min-w-0 text-[11px] font-semibold text-cam-muted">
              <span>{t("dimGender")}</span>
              <input
                type="text"
                value={advGender}
                onChange={(e) => setAdvGender(e.target.value)}
                placeholder={t("dimGenderPlaceholder")}
                list="discover-gender-presets"
                className="form-input mt-1 w-full"
                autoComplete="off"
              />
            </label>
            <label className="block min-w-0 text-[11px] font-semibold text-cam-muted xl:col-span-2 2xl:col-span-1">
              <span>{t("sortLabel")}</span>
              <select
                className="form-input mt-1 w-full"
                value={advSort}
                onChange={(e) =>
                  setAdvSort(e.target.value as typeof advSort)
                }
              >
                <option value="relevance">{t("sortRelevance")}</option>
                <option value="new">{t("sortNew")}</option>
                <option value="followers">{t("sortFollowers")}</option>
              </select>
            </label>
          </div>

          <datalist id="discover-lang-presets">
            <option value="it" />
            <option value="en" />
            <option value="es" />
            <option value="fr" />
            <option value="de" />
            <option value="pt" />
          </datalist>
          <datalist id="discover-country-presets">
            <option value="IT" />
            <option value="ES" />
            <option value="FR" />
            <option value="DE" />
            <option value="UK" />
            <option value="US" />
            <option value="BR" />
          </datalist>
          <datalist id="discover-gender-presets">
            <option value="female" />
            <option value="male" />
            <option value="trans" />
            <option value="couple" />
          </datalist>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-full bg-cam-cta px-4 py-2 text-xs font-bold uppercase tracking-wide text-cam-ink"
              onClick={() => void runSearch()}
            >
              {t("applyFilters")}
            </button>
            <button
              type="button"
              className="rounded-full border border-cam-border px-4 py-2 text-xs font-semibold text-cam-muted hover:border-cam-orange hover:text-cam-orange"
              onClick={() => {
                setAdvSort("new");
                void runSearch({ sort: "new" });
                requestAnimationFrame(() => {
                  document
                    .getElementById("discover-new-models")
                    ?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                });
              }}
              aria-label={t("shortcutNewCreatorsAria")}
            >
              {t("shortcutNewCreators")}
            </button>
            <button
              type="button"
              className="rounded-full border border-cam-border px-4 py-2 text-xs font-semibold text-cam-muted hover:border-cam-orange hover:text-cam-orange"
              onClick={() => clearAllFilters()}
            >
              {t("clearFilters")}
            </button>
          </div>
        </section>

        {categories.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-cam-muted">
              {t("sectionCategories")}
            </h2>
            <div className="flex flex-wrap gap-2">
              {categories.slice(0, 24).map((c) => (
                <button
                  key={c.name}
                  type="button"
                  className="rounded-full border border-cam-border bg-cam-ink px-3 py-1.5 text-xs font-medium text-cam-text hover:border-cam-orange/70"
                  title={formatInteger(c.count)}
                  onClick={() => {
                    setAdvCategory(c.name);
                    setAdvOpen(false);
                    void runSearch({
                      category: c.name,
                    });
                  }}
                >
                  {c.name}
                  <span className="ml-1.5 tabular-nums text-cam-muted">
                    ({formatInteger(c.count)})
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {advOpen && (
          <section className="mb-8 rounded-md border border-cam-border bg-cam-card p-4 shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-cam-muted">
              {t("advancedTitle")}
            </h2>
            <p className="mb-3 text-xs text-cam-muted">{t("advancedHint")}</p>
            <label className="flex items-center gap-2 text-[12px] text-cam-text">
              <input
                type="checkbox"
                checked={advCouple}
                onChange={(e) => setAdvCouple(e.target.checked)}
              />
              {t("filterCouple")}
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full bg-cam-cta px-4 py-2 text-xs font-bold uppercase tracking-wide text-cam-ink"
                onClick={() => void runSearch()}
              >
                {t("applyFilters")}
              </button>
              <button
                type="button"
                className="rounded-full border border-cam-border px-4 py-2 text-xs font-semibold text-cam-muted hover:border-cam-orange"
                onClick={() => {
                  setAdvCouple(false);
                  setResults(null);
                }}
              >
                {t("clearAdvancedOnly")}
              </button>
            </div>
          </section>
        )}

        {results && (
          <section className="mb-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-cam-muted">
              {t("results")}
            </h2>
            {!results.length ? (
              <p className="text-sm text-cam-muted">{t("noUsers")}</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((u) => {
                  const thumb =
                    u.avatarUrl ||
                    `https://picsum.photos/seed/${encodeURIComponent(u.id)}/120/120`;
                  const subtitle = [
                    u.category,
                    typeof u.followerCount === "number"
                      ? `${formatInteger(u.followerCount)} ${t("followersLabel")}`
                      : null,
                    u.isLive ? `${formatInteger(u.viewers)} 👁` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");

                  const openLive = u.isLive && u.canOpenDiscoverLive;

                  return (
                    <li
                      key={u.id}
                      className="flex items-center gap-3 rounded-md border border-cam-border bg-cam-card p-3 shadow-[0_4px_20px_rgba(0,0,0,0.35)]"
                    >
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-cam-ink">
                        <Image
                          src={thumb}
                          alt=""
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-cam-text">
                          {u.username}
                        </p>
                        <p className="truncate text-[11px] text-cam-muted">
                          {subtitle || "—"}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <FollowButton userId={u.id} />
                          <Link
                            href={`/u/${u.id}`}
                            className="rounded-full border border-cam-border px-2.5 py-1 text-[11px] font-medium text-cam-muted hover:border-cam-orange hover:text-cam-orange-bright"
                          >
                            {t("profileLink")}
                          </Link>
                          <Link
                            href={openLive ? `/live/${u.id}` : `/u/${u.id}`}
                            className="rounded-full bg-cam-cta px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-cam-ink"
                          >
                            {openLive ? t("joinLiveLink") : t("offlineLabel")}
                          </Link>
                          <Link
                            href={`/messages?peer=${encodeURIComponent(u.id)}`}
                            className="rounded-full border border-cam-border px-2.5 py-1 text-[11px] font-medium text-cam-muted hover:border-cam-orange hover:text-cam-orange-bright"
                          >
                            {t("messageLink")}
                          </Link>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        <DiscoverShelf title={t("sectionOnline")} models={onlineModels} />
        <DiscoverShelf title={t("sectionTrending")} models={trending} />
        <DiscoverShelf title={t("sectionRecommended")} models={recommended} />
        <DiscoverShelf
          sectionId="discover-new-models"
          title={t("sectionNew")}
          models={newModels}
        />
        <DiscoverShelf
          title={`${t("sectionTopEarners")}: ${t("topEarnersHint")}`}
          models={topEarnersShelf}
        />

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-cam-muted">
            {t("liveGridHeading")}
          </h2>
        </section>
      </div>

      <TagBar active={tag} onChange={setTag} />
      <section className="mx-auto w-full max-w-[1600px] px-2 py-4 lg:px-4">
        <LiveDirectory tag={tag} />
      </section>
    </AppShell>
  );
}
