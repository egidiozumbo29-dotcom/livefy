import type { ModelCardProps } from "@/components/live/ModelCard";
import { apiUrl, fetchWithTimeout } from "@/services/api";

export type ShowMode = "PUBLIC" | "BASE" | "PRIVATE";

export type LiveApiRow = {
  id: string;
  streamId: string;
  room: string | null;
  title: string;
  subject?: string;
  viewers: number;
  thumbnail: string | null;
  showMode?: ShowMode;
  basePrice?: number;
  privatePricePerMinute?: number;
  chatOpen?: boolean;
  tipsTotal?: number;
  creator: {
    id: string;
    username: string;
    avatarUrl: string | null;
    category: string | null;
    tags: string[];
    language?: string | null;
    country?: string | null;
  };
};

/** Inferisce la gender icon dai tag/category quando User.gender non c'e'. */
export function inferGenderFromProfile(
  tags: string[],
  category: string | null,
): "F" | "M" | "T" | "C" | null {
  const blob = `${(tags ?? []).join(" ")} ${category ?? ""}`.toLowerCase();
  if (/\bcouple|coppia|couples|coppie\b/.test(blob)) return "C";
  if (/\btrans|trav|tgirl|tboy\b/.test(blob)) return "T";
  if (/\bmale|man|guy|boy|gay\b/.test(blob)) return "M";
  if (/\bfemale|woman|girl|milf|teen|lesbian\b/.test(blob)) return "F";
  return null;
}

export function mapLiveRowsToModels(data: LiveApiRow[]): ModelCardProps[] {
  return data.map((row) => ({
    id: row.creator.id,
    name: row.creator.username,
    category: row.creator.category ?? "Live",
    subject: row.subject ?? row.title ?? "",
    viewers: row.viewers,
    thumbnail: row.thumbnail ?? row.creator.avatarUrl ?? undefined,
    tags: row.creator.tags ?? [],
    isLive: true,
    isHd: true,
    region: row.creator.country ?? null,
    gender: inferGenderFromProfile(
      row.creator.tags ?? [],
      row.creator.category ?? null,
    ),
    showMode: row.showMode ?? "PUBLIC",
    basePrice: row.basePrice ?? 0,
    privatePricePerMinute: row.privatePricePerMinute ?? 0,
    tipsTotal: row.tipsTotal ?? 0,
  }));
}

export async function fetchLiveStreams(): Promise<ModelCardProps[]> {
  try {
    const res = await fetchWithTimeout(apiUrl("/streams/live"), {
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(
        "[fetchLiveStreams] HTTP",
        res.status,
        "— mostro griglia vuota (avvia API su :4000 per le live).",
      );
      return [];
    }
    const raw: unknown = await res.json();
    if (!Array.isArray(raw)) return [];
    return mapLiveRowsToModels(raw as LiveApiRow[]);
  } catch (e) {
    console.warn(
      "[fetchLiveStreams] errore rete o timeout — mostro griglia vuota:",
      e,
    );
    return [];
  }
}
