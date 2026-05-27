"use client";

import { ModelCard, type ModelCardProps } from "@/components/live/ModelCard";

export function DiscoverShelf({
  title,
  models,
  emptyHint,
  sectionId,
}: {
  title: string;
  models: ModelCardProps[];
  emptyHint?: string;
  /** Ancora scroll (es. `discover-new-models` per shortcut “Nuovi creator”). */
  sectionId?: string;
}) {
  const sectionCls = "mb-8 scroll-mt-24";

  if (!models.length) {
    return (
      <section id={sectionId} className={sectionCls}>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-cam-muted">
          {title}
        </h2>
        {emptyHint ? (
          <p className="text-sm text-cam-muted">{emptyHint}</p>
        ) : null}
      </section>
    );
  }

  return (
    <section id={sectionId} className={sectionCls}>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-cam-muted">
        {title}
      </h2>
      <div className="flex gap-2 overflow-x-auto pb-2 pt-0.5 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5">
        {models.map((m) => (
          <div
            key={m.id}
            className="w-[42vw] shrink-0 snap-start sm:w-52 md:w-56"
          >
            <ModelCard {...m} />
          </div>
        ))}
      </div>
    </section>
  );
}
