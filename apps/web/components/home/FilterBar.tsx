"use client";

import {
  DIRECTORY_FILTER_OPTIONS,
  type DirectoryFilterId,
} from "@/lib/directory-filters";

export function FilterBar({
  value,
  onChange,
}: {
  value: DirectoryFilterId;
  onChange: (id: DirectoryFilterId) => void;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {DIRECTORY_FILTER_OPTIONS.map(({ id, label }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={active}
            className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${
              active
                ? "border-violet-core/70 bg-violet-core/15 text-white"
                : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-violet-core/50 hover:text-white"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
