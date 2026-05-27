import type { GalleryRow } from "@/components/gallery/CreatorGallery";
import type { PublicMeta } from "./live-room-client";
import { LiveRoomClient } from "./live-room-client";
import { getApiBaseUrl } from "@/services/api";

export default async function LiveRoomPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  const apiBase = getApiBaseUrl();

  let meta: PublicMeta | null = null;
  let galleryPhotos: GalleryRow[] = [];
  let galleryVideos: GalleryRow[] = [];

  try {
    const [metaRes, galleryRes] = await Promise.all([
      fetch(`${apiBase}/streams/public/${encodeURIComponent(id)}/meta`, {
        cache: "no-store",
      }).catch(() => null),
      fetch(`${apiBase}/creators/gallery/${encodeURIComponent(id)}`, {
        cache: "no-store",
      }).catch(() => null),
    ]);

    if (metaRes?.ok) {
      try {
        meta = (await metaRes.json()) as PublicMeta;
      } catch {
        meta = null;
      }
    }

    if (galleryRes?.ok) {
      try {
        const data = (await galleryRes.json()) as { items?: GalleryRow[] };
        const items = data.items ?? [];
        galleryPhotos = items.filter((r) => r.kind === "PHOTO");
        galleryVideos = items.filter((r) => r.kind === "VIDEO");
      } catch {
        /* ignore malformed gallery */
      }
    }
  } catch {
    meta = null;
  }

  return (
    <LiveRoomClient
      creatorId={id}
      meta={meta}
      galleryPhotos={galleryPhotos}
      galleryVideos={galleryVideos}
    />
  );
}
