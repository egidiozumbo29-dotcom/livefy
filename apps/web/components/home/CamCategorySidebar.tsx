"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { GenderTab } from "./GenderTabs";

type Props = {
  active: GenderTab;
  onChange: (tab: GenderTab) => void;
};

const ROWS: { id: GenderTab; sym: string }[] = [
  { id: "featured", sym: "★" },
  { id: "female", sym: "♀" },
  { id: "male", sym: "♂" },
  { id: "couples", sym: "⚤" },
  { id: "trans", sym: "⚧" },
  { id: "all", sym: "◎" },
];

/**
 * Barra categoria verticale (desktop), pattern tipico directory live cam.
 */
export function CamCategorySidebar({ active, onChange }: Props) {
  const tg = useTranslations("genderTabs");
  const tSide = useTranslations("camSidebar");

  const items = useMemo(
    () =>
      ROWS.map((r) => ({
        ...r,
        label: tg(r.id),
      })),
    [tg],
  );

  return (
    <aside
      className="hidden w-[200px] shrink-0 flex-col border-r border-cam-border bg-cam-sidebar lg:flex"
      aria-label={tSide("aria")}
    >
      <div className="border-b border-cam-border px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-cam-orange">
          {tSide("heading")}
        </p>
      </div>
      <nav className="flex flex-col gap-0.5 p-2">
        {items.map((row) => {
          const isOn = active === row.id;
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => onChange(row.id)}
              className={`flex items-center gap-3 rounded-md px-2.5 py-2.5 text-left text-sm font-semibold transition ${
                isOn
                  ? "bg-cam-orange/15 text-cam-orange-bright shadow-[inset_3px_0_0_0_#ff8c00]"
                  : "text-cam-muted hover:bg-cam-card hover:text-cam-text"
              }`}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-cam-ink text-base text-cam-text"
                aria-hidden
              >
                {row.sym}
              </span>
              <span className="truncate">{row.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
