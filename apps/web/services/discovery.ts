import type { ModelCardProps } from "@/components/live/ModelCard";
import { apiUrl, fetchWithTimeout } from "@/services/api";
import {
  inferGenderFromProfile,
  mapLiveRowsToModels,
  type LiveApiRow,
} from "@/services/live-streams";

export type DiscoveryCategory = { name: string; count: number };

export type DiscoveryCreatorRow = {
  id: string;
  username: string;
  avatarUrl: string | null;
  category: string | null;
  tags: string[];
  gender?: string | null;
  country?: string | null;
  isLive: boolean;
  viewers: number;
  liveTitle?: string | null;
  canOpenDiscoverLive: boolean;
};

export type DiscoveryTopEarnerRow = DiscoveryCreatorRow & {
  tipTokens: number;
};

export type DiscoverySearchRow = DiscoveryCreatorRow & {
  language?: string | null;
  languages?: string[];
  isCouple?: boolean;
  createdAt?: string;
  followerCount?: number;
};

function normalizeGender(
  raw: string | null | undefined,
): ModelCardProps["gender"] {
  if (!raw?.trim()) return null;
  const x = raw.trim().toLowerCase();
  if (["f", "female", "woman", "girl", "donna", "ragazza"].includes(x))
    return "F";
  if (["m", "male", "man", "guy", "boy", "uomo", "ragazzo"].includes(x))
    return "M";
  if (["t", "trans", "trav", "non-binary", "nb"].includes(x)) return "T";
  if (["c", "couple", "coppia", "coppie"].includes(x)) return "C";
  return null;
}

function genderForCard(
  tags: string[],
  category: string | null,
  raw?: string | null,
): ModelCardProps["gender"] {
  return normalizeGender(raw) ?? inferGenderFromProfile(tags, category);
}

/** Card per scaffali Discover (live pubblica → /live, altrimenti profilo). */
export function mapDiscoveryCreatorToModelCard(
  row: DiscoveryCreatorRow & { subjectOverride?: string | null },
): ModelCardProps {
  const showAsLive = row.isLive && row.canOpenDiscoverLive;
  const subject =
    row.subjectOverride?.trim() ||
    row.liveTitle?.trim() ||
    "";

  return {
    id: row.id,
    name: row.username,
    category: row.category ?? "Creator",
    subject,
    viewers: showAsLive ? row.viewers : 0,
    thumbnail: row.avatarUrl ?? undefined,
    tags: row.tags ?? [],
    isLive: showAsLive,
    isHd: true,
    region: row.country ?? null,
    gender: genderForCard(row.tags ?? [], row.category ?? null, row.gender),
    watchHref: showAsLive ? undefined : `/u/${row.id}`,
  };
}

function qparams(
  r: Record<string, string | number | boolean | undefined | null>,
): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(r)) {
    if (v === undefined || v === null || v === "") continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function fetchDiscoveryCategories(): Promise<DiscoveryCategory[]> {
  try {
    const res = await fetchWithTimeout(apiUrl("/discovery/categories"), {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const d = (await res.json()) as { items?: DiscoveryCategory[] };
    return d.items ?? [];
  } catch {
    return [];
  }
}

export async function fetchDiscoveryOnlineModels(
  take = 24,
): Promise<ModelCardProps[]> {
  try {
    const res = await fetchWithTimeout(
      apiUrl(`/discovery/online-models${qparams({ take })}`),
      { cache: "no-store" },
    );
    if (!res.ok) return [];
    const d = (await res.json()) as { items?: DiscoveryCreatorRow[] };
    return (d.items ?? []).map((r) => mapDiscoveryCreatorToModelCard(r));
  } catch {
    return [];
  }
}

export async function fetchDiscoveryTrendingLive(
  take = 24,
): Promise<ModelCardProps[]> {
  try {
    const res = await fetchWithTimeout(
      apiUrl(`/discovery/trending-live${qparams({ take })}`),
      { cache: "no-store" },
    );
    if (!res.ok) return [];
    const raw = (await res.json()) as { items?: LiveApiRow[] };
    return mapLiveRowsToModels(raw.items ?? []);
  } catch {
    return [];
  }
}

export async function fetchDiscoveryRecommended(
  take = 18,
): Promise<ModelCardProps[]> {
  try {
    const res = await fetchWithTimeout(
      apiUrl(`/discovery/recommended${qparams({ take })}`),
      { cache: "no-store" },
    );
    if (!res.ok) return [];
    const d = (await res.json()) as { items?: DiscoveryCreatorRow[] };
    return (d.items ?? []).map((r) => mapDiscoveryCreatorToModelCard(r));
  } catch {
    return [];
  }
}

export async function fetchDiscoveryNewModels(
  take = 18,
): Promise<ModelCardProps[]> {
  try {
    const res = await fetchWithTimeout(
      apiUrl(`/discovery/new-models${qparams({ take })}`),
      { cache: "no-store" },
    );
    if (!res.ok) return [];
    const d = (await res.json()) as { items?: DiscoveryCreatorRow[] };
    return (d.items ?? []).map((r) => mapDiscoveryCreatorToModelCard(r));
  } catch {
    return [];
  }
}

export async function fetchDiscoveryTopEarners(
  take = 15,
  windowDays = 30,
): Promise<DiscoveryTopEarnerRow[]> {
  try {
    const res = await fetchWithTimeout(
      apiUrl(`/discovery/top-earners${qparams({ take, windowDays })}`),
      { cache: "no-store" },
    );
    if (!res.ok) return [];
    const d = (await res.json()) as { items?: DiscoveryTopEarnerRow[] };
    return d.items ?? [];
  } catch {
    return [];
  }
}

export type DiscoverySearchParams = {
  q?: string;
  category?: string;
  gender?: string;
  country?: string;
  language?: string;
  tag?: string;
  coupleOnly?: boolean;
  sort?: "new" | "followers" | "relevance";
  take?: number;
};

export async function fetchDiscoverySearch(
  filters: DiscoverySearchParams,
): Promise<DiscoverySearchRow[]> {
  try {
    const res = await fetchWithTimeout(
      apiUrl(
        `/discovery/search${qparams({
          q: filters.q,
          category: filters.category,
          gender: filters.gender,
          country: filters.country,
          language: filters.language,
          tag: filters.tag,
          coupleOnly: filters.coupleOnly === true ? true : undefined,
          sort: filters.sort,
          take: filters.take ?? 24,
        })}`,
      ),
      { cache: "no-store" },
    );
    if (!res.ok) return [];
    const d = (await res.json()) as { items?: DiscoverySearchRow[] };
    return d.items ?? [];
  } catch {
    return [];
  }
}
