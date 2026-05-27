import { TOKEN_KEY } from "./session";

/** Base assoluta Nest lato server (Node non può fare fetch a path relativi). */
const INTERNAL_API_FALLBACK = "http://127.0.0.1:4000/api";

/**
 * Base pubblica per fetch lato browser quando non c’è env (dev): proxy Next `/_nestjs/*` → Nest `/api/*`.
 * In produzione imposta `NEXT_PUBLIC_API_URL=https://…/api` nel build.
 */
const BROWSER_RELATIVE_PROXY_BASE = "/_nestjs";

/** @deprecated Usa getApiBaseUrl() */
export const DEFAULT_API_BASE = INTERNAL_API_FALLBACK;

/** Evita fetch appesi (es. API spenta) che lasciano la UI in loading infinito. */
const DEFAULT_FETCH_TIMEOUT_MS = 12_000;

export function fetchWithTimeout(
  url: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const timeoutMs = init?.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  const { timeoutMs: _omit, ...rest } = init ?? {};
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...rest, signal: controller.signal })
    .catch((err: unknown) => {
      if (
        err instanceof DOMException &&
        err.name === "AbortError"
      ) {
        throw new Error(
          `Timeout dopo ${timeoutMs / 1000}s — avvia l’API su ${getApiBaseUrl()} o controlla NEXT_PUBLIC_API_URL.`,
        );
      }
      throw err;
    })
    .finally(() => clearTimeout(id));
}

/**
 * Base URL API (senza slash finale). Browser: path relativo `/_nestjs` o URL assoluto da env.
 * Server: sempre assoluto verso Nest (`API_INTERNAL_ORIGIN` + `/api`).
 */
export function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (!raw) {
    if (typeof window === "undefined") {
      return INTERNAL_API_FALLBACK.replace(/\/$/, "");
    }
    return BROWSER_RELATIVE_PROXY_BASE;
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw.replace(/\/$/, "");
  }

  if (raw.startsWith("/")) {
    if (typeof window === "undefined") {
      const internal =
        process.env.API_INTERNAL_ORIGIN?.trim().replace(/\/$/, "") ??
        "http://127.0.0.1:4000";
      return `${internal}/api`.replace(/\/$/, "");
    }
    return raw.replace(/\/$/, "");
  }

  return raw.replace(/\/$/, "");
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function apiUrl(path: string) {
  const base = getApiBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export async function apiFetch(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  const t = getStoredToken();
  if (t) headers.set("Authorization", `Bearer ${t}`);
  if (
    init?.body &&
    typeof init.body === "string" &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(apiUrl(path), { ...init, headers });
}
