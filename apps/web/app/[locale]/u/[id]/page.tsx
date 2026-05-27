import type { GalleryRow } from "@/components/gallery/CreatorGallery";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import {
  CreatorProfileClient,
  type PublicProfile,
  type TipMenuItem,
} from "./creator-profile-client";
import { getApiBaseUrl } from "@/services/api";

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export default async function CreatorProfilePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  const base = getApiBaseUrl();

  const [profile, tipMenu, galleryPack] = await Promise.all([
    fetchJson<PublicProfile>(`${base}/users/${encodeURIComponent(id)}`),
    fetchJson<TipMenuItem[]>(
      `${base}/creators/menu/${encodeURIComponent(id)}`,
    ),
    fetchJson<{ items: GalleryRow[] }>(
      `${base}/creators/gallery/${encodeURIComponent(id)}`,
    ),
  ]);

  if (!profile) notFound();

  const gItems = galleryPack?.items ?? [];
  const galleryPhotos = gItems.filter((r) => r.kind === "PHOTO");
  const galleryVideos = gItems.filter((r) => r.kind === "VIDEO");

  return (
    <CreatorProfileClient
      profile={profile}
      tipMenu={tipMenu ?? []}
      galleryPhotos={galleryPhotos}
      galleryVideos={galleryVideos}
    />
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  try {
    const t = await getTranslations({ locale, namespace: "meta" });
    return {
      title: `${t("profileTitle")} ${id}`,
    };
  } catch {
    return {
      title: String(id ?? "Profile"),
    };
  }
}
