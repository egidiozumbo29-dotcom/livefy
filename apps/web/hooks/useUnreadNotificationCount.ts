"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/services/api";

/** Contatore unread per badge header (polling leggero allineato a NotificationBell). */
export function useUnreadNotificationCount(
  enabled: boolean,
  bump?: number,
): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }
    async function fetchCount() {
      const res = await apiFetch("/notifications?take=1");
      if (!res.ok) return;
      try {
        const data = (await res.json()) as { unreadCount?: number };
        if (typeof data.unreadCount === "number") setCount(data.unreadCount);
      } catch {
        /* no-op */
      }
    }

    void fetchCount();
    const id = window.setInterval(() => void fetchCount(), 75_000);
    return () => window.clearInterval(id);
  }, [enabled, bump]);

  return count;
}
