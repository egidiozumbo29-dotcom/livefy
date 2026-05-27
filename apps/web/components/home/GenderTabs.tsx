"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export type GenderTab =
  | "featured"
  | "female"
  | "male"
  | "couples"
  | "trans"
  | "all";

type Props = {
  active: GenderTab;
  onChange?: (tab: GenderTab) => void;
  /** Es. nascondi su desktop se usi `CamCategorySidebar`. */
  className?: string;
};

export function GenderTabs({ active, onChange, className = "" }: Props) {
  const tg = useTranslations("genderTabs");
  const TABS = useMemo(
    () =>
      (
        [
          ["featured", "/?cat=featured"],
          ["female", "/?cat=female"],
          ["male", "/?cat=male"],
          ["couples", "/?cat=couples"],
          ["trans", "/?cat=trans"],
          ["all", "/?cat=all"],
        ] as const
      ).map(([id, href]) => ({
        id,
        label: tg(id),
        href,
      })),
    [tg],
  );

  return (
    <nav
      className={`border-b border-cam-border bg-cam-ink ${className}`}
      aria-label={tg("ariaNav")}
    >
      <div className="mx-auto max-w-[1600px] px-2 lg:px-4">
        <ul className="no-scrollbar flex items-center gap-1 overflow-x-auto">
          {TABS.map((row) => {
            const isActive = active === row.id;
            return (
              <li key={row.id}>
                {onChange ? (
                  <button
                    type="button"
                    onClick={() => onChange(row.id as GenderTab)}
                    className={`relative whitespace-nowrap px-4 py-3 text-sm font-semibold uppercase tracking-wide transition ${
                      isActive
                        ? "text-cam-orange-bright"
                        : "text-cam-muted hover:text-cam-orange/90"
                    }`}
                  >
                    {row.label}
                    {isActive && (
                      <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-t bg-cam-orange" />
                    )}
                  </button>
                ) : (
                  <Link
                    href={row.href}
                    className={`relative block whitespace-nowrap px-4 py-3 text-sm font-semibold uppercase tracking-wide transition ${
                      isActive
                        ? "text-cam-orange-bright"
                        : "text-cam-muted hover:text-cam-orange/90"
                    }`}
                  >
                    {row.label}
                    {isActive && (
                      <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-t bg-cam-orange" />
                    )}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
