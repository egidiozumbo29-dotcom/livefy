"use client";

import { useEffect } from "react";
import { apiFetch } from "@/services/api";
import { persistAuth } from "@/services/session";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setCredentials, type AuthUser } from "@/store/slices/authSlice";

declare global {
  interface WindowEventMap {
    "synthra:balance-sync": CustomEvent;
  }
}

function dispatchBalanceSync() {
  window.dispatchEvent(new CustomEvent("synthra:balance-sync"));
}

export { dispatchBalanceSync };

/**
 * Aggiorna saldo dall’API ogni ~45s e quando parte l’evento `synthra:balance-sync`
 * (tip, checkout Stripe, ingressi pagati sulla live).
 */
export function BalanceSyncSubscriber() {
  const token = useAppSelector((s) => s.auth.token);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!token) return;
    const authToken = token;

    let cancelled = false;
    async function pull() {
      const res = await apiFetch("/users/me");
      if (!res.ok || cancelled) return;
      const user = (await res.json()) as AuthUser;
      if (cancelled) return;
      dispatch(setCredentials({ token: authToken, user }));
      persistAuth(authToken, user);
    }

    void pull();

    const interval = window.setInterval(() => void pull(), 45_000);
    const handleSync = () => void pull();
    window.addEventListener("synthra:balance-sync", handleSync);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("synthra:balance-sync", handleSync);
    };
  }, [token, dispatch]);

  return null;
}
