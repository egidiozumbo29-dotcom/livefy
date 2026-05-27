"use client";

import { useTranslations } from "next-intl";

const POPULAR_TAGS = [
  "new",
  "asian",
  "ebony",
  "latina",
  "blonde",
  "brunette",
  "milf",
  "teen",
  "bbw",
  "fit",
  "bigboobs",
  "smalltits",
  "feet",
  "lush",
  "anal",
  "squirt",
  "lovense",
  "couple",
  "lesbian",
  "gay",
  "bdsm",
  "domination",
  "italian",
  "english",
  "spanish",
] as const;

type Props = {
  active: string | null;
  onChange: (tag: string | null) => void;
};

export function TagBar({ active, onChange }: Props) {
  const t = useTranslations("tagBar");

  return (
    <div className="border-b border-cam-border bg-cam-ink">
      <div className="mx-auto max-w-[1600px] px-2 py-2 lg:px-4">
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => onChange(null)}
            className={`chip ${active === null ? "chip-active" : ""}`}
          >
            {t("clearTags")}
          </button>
          {POPULAR_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onChange(tag === active ? null : tag)}
              className={`chip ${active === tag ? "chip-active" : ""}`}
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
