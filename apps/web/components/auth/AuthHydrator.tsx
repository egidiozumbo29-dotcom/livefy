"use client";

import { useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { setCredentials, type AuthUser } from "@/store/slices/authSlice";
import { TOKEN_KEY, USER_KEY } from "@/services/session";

export function AuthHydrator() {
  const dispatch = useAppDispatch();
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const raw = localStorage.getItem(USER_KEY);
    if (!token || !raw) return;
    try {
      const user = JSON.parse(raw) as AuthUser;
      if (user?.id && user?.email && user?.role) {
        dispatch(setCredentials({ token, user }));
      }
    } catch {
      /* ignore */
    }
  }, [dispatch]);
  return null;
}
