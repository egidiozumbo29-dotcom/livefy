"use client";

import { useEffect } from "react";
import { apiFetch } from "@/services/api";
import { useAppSelector } from "@/store/hooks";

/** Aggiorna `lastSeenAt` mentre l’utente naviga il sito (debounce anche lato API). */
export function PresencePinger() {
  const token = useAppSelector((s) => s.auth.token);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const ping = () => {
      if (cancelled) return;
      void apiFetch("/users/me/presence", { method: "POST" }).catch(() => {
        /* no-op */
      });
    };

    ping();
    const timer = window.setInterval(ping, 90_000);
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") ping();
    });

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [token]);

  return null;
}
