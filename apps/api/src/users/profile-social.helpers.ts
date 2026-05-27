/** Chiavi consentite nei link social pubblici (solo https/http). */

export const SOCIAL_LINK_KEYS = [
  "twitter",
  "instagram",
  "tiktok",
  "youtube",
  "onlyfans",
  "linktree",
  "website",
] as const;

export type SocialLinkKey = (typeof SOCIAL_LINK_KEYS)[number];

function coerceHttpUrl(raw: string): string | null {
  const s = raw.trim().slice(0, 2048);
  if (!s) return null;
  try {
    const url = new URL(/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(s) ? s : `https://${s}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Normalizza dal body PATCH: rimpiazza l’intero blocco links (solo chiavi note); oggetto vuoto = rimuovi tutti. */
export function normalizeSocialLinksPayload(
  input: Record<string, unknown> | undefined,
): Partial<Record<SocialLinkKey, string>> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const out: Partial<Record<SocialLinkKey, string>> = {};
  for (const key of SOCIAL_LINK_KEYS) {
    const v = input[key];
    if (v === undefined || v === null || v === "") continue;
    if (typeof v !== "string") continue;
    const ok = coerceHttpUrl(v);
    if (ok) out[key] = ok;
  }
  return out;
}

/** Output pubblico sicuro dopo lettura Json da DB. */
export function sanitizeSocialLinksStored(
  raw: unknown,
): Partial<Record<SocialLinkKey, string>> | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const out: Partial<Record<SocialLinkKey, string>> = {};
  for (const key of SOCIAL_LINK_KEYS) {
    const v = obj[key];
    if (typeof v !== "string" || !v.trim()) continue;
    const ok = coerceHttpUrl(v);
    if (ok) out[key] = ok;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Finestra “online”: ultimo ping / navigazione nell’account. */
export const ONLINE_PRESENCE_MS = 6 * 60 * 1000;

export function mergedDisplayLanguages(
  primary: string | null | undefined,
  extra: string[] | null | undefined,
): string[] {
  const p = primary?.trim();
  const rest = (extra ?? [])
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 24);
  const seen = new Set<string>();
  const out: string[] = [];
  if (p && !seen.has(p.toLowerCase())) {
    seen.add(p.toLowerCase());
    out.push(p);
  }
  for (const l of rest) {
    const k = l.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(l);
    if (out.length >= 16) break;
  }
  return out;
}

export function isUserOnlinePresence(isLive: boolean, lastSeenAt: Date | null): boolean {
  if (isLive) return true;
  if (!lastSeenAt) return false;
  return Date.now() - lastSeenAt.getTime() <= ONLINE_PRESENCE_MS;
}
