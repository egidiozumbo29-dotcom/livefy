"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useCallback, useState } from "react";
import { formatInteger } from "@/lib/format";
import { apiFetch, apiUrl } from "@/services/api";
import { dispatchBalanceSync } from "@/hooks/useBalanceSync";
import { useAppSelector } from "@/store/hooks";

export type GalleryRow = {
  id: string;
  kind: "PHOTO" | "VIDEO";
  title: string;
  tokenPrice: number;
  thumbnailUrl: string | null;
  mediaUrl: string | null;
  unlocked: boolean;
};

type Props = {
  creatorId: string;
  kind: "PHOTO" | "VIDEO";
  initialItems: GalleryRow[];
};

type GalleryToast =
  | null
  | { type: "login" }
  | { type: "balance" }
  | { type: "free" }
  | { type: "own" }
  | { type: "raw"; text: string };

function mapPurchaseCode(code: string): GalleryToast {
  if (code === "saldo_insufficiente") return { type: "balance" };
  if (code === "contenuto_gratuito") return { type: "free" };
  if (code === "acquisto_proprio_contenuto") return { type: "own" };
  return { type: "raw", text: code };
}

export function CreatorGallery({ creatorId, kind, initialItems }: Props) {
  const t = useTranslations("gallery");
  const token = useAppSelector((s) => s.auth.token);
  const [items, setItems] = useState<GalleryRow[]>(
    initialItems.filter((r) => r.kind === kind),
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<GalleryToast>(null);

  const reload = useCallback(async () => {
    const headers: HeadersInit = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(
      apiUrl(`/creators/gallery/${encodeURIComponent(creatorId)}`),
      { headers, cache: "no-store" },
    );
    if (!res.ok) return;
    const data = (await res.json()) as { items: GalleryRow[] };
    setItems(data.items.filter((r) => r.kind === kind));
  }, [creatorId, kind, token]);

  async function purchase(itemId: string) {
    if (!token) {
      setToast({ type: "login" });
      return;
    }
    setBusyId(itemId);
    setToast(null);
    try {
      const res = await apiFetch(
        `/creators/gallery-items/${encodeURIComponent(itemId)}/purchase`,
        { method: "POST" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg =
          typeof body.message === "string" ? body.message : `errore_${res.status}`;
        setToast(mapPurchaseCode(msg));
        return;
      }
      await reload();
      dispatchBalanceSync();
    } finally {
      setBusyId(null);
    }
  }

  const list = items;
  if (list.length === 0) {
    return (
      <p className="text-sm text-gray-500">{t("emptyCollection")}</p>
    );
  }

  return (
    <div className="space-y-4">
      {toast && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {toast.type === "login" ? (
            <>
              {t("loginPrompt")}{" "}
              <Link href="/login" className="font-bold underline">
                {t("loginShort")}
              </Link>
            </>
          ) : toast.type === "balance" ? (
            <>
              {t("errors.balance")}{" "}
              <Link href="/wallet" className="font-bold underline">
                {t("walletShort")}
              </Link>
            </>
          ) : toast.type === "free" ? (
            t("errors.free")
          ) : toast.type === "own" ? (
            t("errors.own")
          ) : (
            toast.text
          )}
        </p>
      )}
      <ul className="grid gap-4 sm:grid-cols-2">
        {list.map((item) => {
          const teaser = item.thumbnailUrl;
          const showMedia = item.unlocked && item.mediaUrl;

          return (
            <li
              key={item.id}
              className="overflow-hidden rounded-md border border-cam-border bg-cam-card shadow-[0_4px_18px_rgba(0,0,0,0.4)]"
            >
              <div className="relative aspect-video w-full overflow-hidden bg-black">
                {item.kind === "VIDEO" && showMedia ? (
                  <video
                    src={item.mediaUrl ?? undefined}
                    controls
                    className="h-full w-full object-contain"
                    playsInline
                  />
                ) : showMedia && item.mediaUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL utente arbitrari, no whitelist remotePatterns
                  <img
                    alt={item.title || t("altFallback")}
                    src={item.mediaUrl}
                    className="h-full w-full object-cover"
                  />
                ) : teaser ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL utente arbitrari, no whitelist remotePatterns
                  <img
                    alt=""
                    src={teaser}
                    className="h-full w-full object-cover blur-sm brightness-75"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-white/70">
                    {t("locked")}
                  </div>
                )}

                {!item.unlocked && item.tokenPrice > 0 && (
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55 px-4 text-center text-white">
                    <p className="text-[11px] font-bold uppercase tracking-wide">
                      {t("unlockFor", {
                        price: formatInteger(item.tokenPrice),
                      })}
                    </p>
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => purchase(item.id)}
                      className="pointer-events-auto rounded-full bg-cam-cta px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-cam-ink shadow disabled:opacity-50"
                    >
                      {busyId === item.id ? t("buyWait") : t("buy")}
                    </button>
                  </div>
                )}
              </div>
              {(item.title || item.tokenPrice <= 0) && (
                <div className="border-t border-cam-border bg-cam-ink px-3 py-2">
                  {item.title && (
                    <p className="truncate text-xs font-semibold text-cam-text">
                      {item.title}
                    </p>
                  )}
                  {item.unlocked && item.tokenPrice <= 0 && (
                    <p className="text-[10px] text-cam-muted">{t("free")}</p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
