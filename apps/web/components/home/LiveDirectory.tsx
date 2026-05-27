"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { LiveGrid } from "@/components/live/LiveGrid";
import type { ModelCardProps } from "@/components/live/ModelCard";
import { fetchLiveStreams } from "@/services/live-streams";

type Props = {
  /** Quando definito, filtra le card per tag esatto (case-insensitive). */
  tag?: string | null;
};

export function LiveDirectory({ tag = null }: Props) {
  const t = useTranslations("discover");
  const [models, setModels] = useState<ModelCardProps[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mapped = await fetchLiveStreams();
      if (!cancelled) setModels(mapped);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayed = useMemo(() => {
    if (!models) return [];
    if (!tag) return models;
    const t = tag.toLowerCase();
    return models.filter((m) =>
      (m.tags ?? []).some((x) => x.toLowerCase() === t),
    );
  }, [models, tag]);

  if (models === null) {
    return (
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 md:gap-2 xl:grid-cols-5 2xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="aspect-video animate-pulse rounded-sm bg-cam-card"
          />
        ))}
      </div>
    );
  }

  if (!models.length) {
    return (
      <p className="text-sm text-cam-muted">
        {t("noPublicStreams")}
      </p>
    );
  }

  if (!displayed.length) {
    return (
      <p className="text-sm text-cam-muted">
        {t("noTagMatch", { tag: tag ?? "" })}
      </p>
    );
  }

  return <LiveGrid models={displayed} />;
}
