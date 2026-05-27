"use client";

import { useEffect } from "react";
import { apiFetch } from "@/services/api";
import { useAppSelector } from "@/store/hooks";

/** Registra una visita profilo/live per cronologia viewer (solo se loggati e ≠ creator). */
export function useTrackProfileVisit(creatorId: string | null | undefined) {
  const token = useAppSelector((s) => s.auth.token);
  const meId = useAppSelector((s) => s.auth.user?.id);

  useEffect(() => {
    if (!token || !creatorId || !meId) return;
    if (meId === creatorId) return;
    void apiFetch(`/viewer-history/${encodeURIComponent(creatorId)}`, {
      method: "POST",
    }).catch(() => {
      /* no-op */
    });
  }, [token, creatorId, meId]);
}
