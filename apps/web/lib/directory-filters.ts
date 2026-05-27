import type { ModelCardProps } from "@/components/live/ModelCard";

export type DirectoryFilterId =
  | "all"
  | "trending"
  | "new"
  | "top"
  | "hd"
  | "lang"
  | "country";

export const DIRECTORY_FILTER_OPTIONS: { id: DirectoryFilterId; label: string }[] =
  [
    { id: "all", label: "Tutti" },
    { id: "trending", label: "Trending" },
    { id: "new", label: "Nuovi" },
    { id: "top", label: "Top earners" },
    { id: "hd", label: "HD" },
    { id: "lang", label: "Lingua" },
    { id: "country", label: "Paese" },
  ];

export function applyDirectoryFilter(
  models: ModelCardProps[],
  id: DirectoryFilterId,
): ModelCardProps[] {
  const copy = [...models];

  switch (id) {
    case "hd":
      return copy.filter((m) => m.isHd);
    case "trending":
      return copy.sort((a, b) => b.viewers - a.viewers).slice(0, 12);
    case "top":
      return copy.sort((a, b) => b.viewers - a.viewers);
    case "new":
      return copy.reverse();
    case "lang":
      return copy.filter((m) =>
        (m.tags ?? []).some((t) => /lingua|lang|ita|eng|fr|es/i.test(t)),
      );
    case "country":
      return copy.filter((m) =>
        (m.tags ?? []).some((t) => /eu|us|uk|ita|country|paese/i.test(t)),
      );
    default:
      return copy;
  }
}
