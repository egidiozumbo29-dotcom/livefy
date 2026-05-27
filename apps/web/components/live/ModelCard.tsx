"use client";

import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { formatInteger } from "@/lib/format";

export type ModelCardProps = {
  id: string;
  name: string;
  /** Override link target (default: `/live/[id]`). Use `/u/[id]` for profile when not in public live. */
  watchHref?: string;
  category: string;
  viewers: number;
  isHd?: boolean;
  isLive?: boolean;
  thumbnail?: string;
  tags?: string[];
  age?: number | null;
  region?: string | null;
  subject?: string;
  gender?: "F" | "M" | "T" | "C" | null;
  showMode?: "PUBLIC" | "BASE" | "PRIVATE";
  basePrice?: number;
  privatePricePerMinute?: number;
  tipsTotal?: number;
};

const GENDER_BADGE: Record<
  NonNullable<ModelCardProps["gender"]>,
  {
    label: string;
    cls: string;
  }
> = {
  F: { label: "♀", cls: "bg-pink-600 text-white" },
  M: { label: "♂", cls: "bg-blue-600 text-white" },
  T: { label: "⚧", cls: "bg-purple-600 text-white" },
  C: { label: "♀♂", cls: "bg-emerald-600 text-white" },
};

export function ModelCard({
  id,
  name,
  viewers,
  isHd = true,
  isLive = true,
  thumbnail,
  tags = [],
  age = null,
  region = null,
  subject = "",
  gender = null,
  showMode = "PUBLIC",
  basePrice = 0,
  privatePricePerMinute = 0,
  watchHref,
}: ModelCardProps) {
  const targetHref = watchHref ?? `/live/${id}`;
  const openLiveLink = watchHref === undefined || watchHref.startsWith("/live/");
  const thumb =
    thumbnail ||
    `https://picsum.photos/seed/${encodeURIComponent(id)}/640/360`;

  const modeBadge =
    showMode === "BASE"
      ? {
          label: `Privato · ${formatInteger(basePrice)} tk`,
          cls: "bg-amber-500 text-amber-950",
        }
      : showMode === "PRIVATE"
        ? {
            label: `Premium 1v1 · ${formatInteger(privatePricePerMinute)} tk/min`,
            cls: "bg-pink-600 text-white",
          }
        : null;

  const genderBadge = gender ? GENDER_BADGE[gender] : null;

  return (
    <article className="group relative overflow-hidden rounded-sm border border-cam-border bg-cam-card shadow-[0_2px_8px_rgba(0,0,0,0.5)] transition hover:z-[1] hover:border-cam-orange/60 hover:shadow-[0_6px_20px_rgba(255,140,0,0.12)]">
      <Link
        href={targetHref}
        className="block"
        aria-label={
          openLiveLink ? `Apri live di ${name}` : `Apri profilo di ${name}`
        }
      >
        <div className="relative aspect-[16/9] overflow-hidden bg-black">
          <Image
            src={thumb}
            alt=""
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover transition duration-200 group-hover:scale-[1.04]"
            unoptimized
          />

          {isHd && (
            <span className="absolute left-1 top-1 rounded-sm bg-black/80 px-1 py-px text-[10px] font-black text-cam-orange">
              HD
            </span>
          )}

          {isLive && (
            <span className="absolute right-1 top-1 inline-flex items-center gap-1 rounded-sm bg-black/80 px-1.5 py-px text-[11px] font-bold tabular-nums text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
              {formatInteger(viewers)}
            </span>
          )}

          {subject && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent px-2 pb-2 pt-8">
              <p
                className="line-clamp-2 text-[11px] leading-snug text-white/95"
                title={subject}
              >
                {subject}
              </p>
            </div>
          )}

          {modeBadge && (
            <span
              className={`absolute bottom-1 right-1 rounded-sm px-1.5 py-px text-[9px] font-black uppercase tracking-wide ${modeBadge.cls}`}
            >
              {modeBadge.label}
            </span>
          )}
        </div>

        <div className="border-t border-cam-border bg-cam-ink px-2 py-1.5">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <h3 className="truncate text-[13px] font-bold text-cam-text">
              {name}
            </h3>
            {age !== null && age !== undefined && (
              <span className="shrink-0 text-xs font-semibold text-cam-muted">
                {age}
              </span>
            )}
            {genderBadge && (
              <span
                className={`inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-sm text-[10px] font-bold ${genderBadge.cls}`}
                aria-label={`Genere ${genderBadge.label}`}
              >
                {genderBadge.label}
              </span>
            )}
            {region && (
              <span className="ml-auto shrink-0 text-[10px] font-bold uppercase tracking-wide text-cam-muted">
                {region}
              </span>
            )}
          </div>
          {tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1 overflow-hidden">
              {tags.slice(0, 3).map((tg) => (
                <span key={tg} className="tag-pill">
                  #{tg}
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>
    </article>
  );
}
