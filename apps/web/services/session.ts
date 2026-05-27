import type { AuthUser } from "@/store/slices/authSlice";

export const TOKEN_KEY = "synthra_token";
export const USER_KEY = "synthra_user";

export function persistAuth(token: string, user: AuthUser) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearPersistedAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
