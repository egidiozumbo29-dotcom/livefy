"use client";

import { ModelCard, type ModelCardProps } from "./ModelCard";

/** Griglia densa come le directory cam (molte colonne su schermi larghi). */
export function LiveGrid({ models }: { models: ModelCardProps[] }) {
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2 md:grid-cols-4 md:gap-2 lg:grid-cols-4 lg:gap-2 xl:grid-cols-5 2xl:grid-cols-6">
      {models.map((m) => (
        <ModelCard key={m.id} {...m} />
      ))}
    </div>
  );
}
