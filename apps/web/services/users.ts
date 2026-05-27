import { apiUrl } from "@/services/api";

export type PublicUserPreview = {
  id: string;
  username: string;
  avatarUrl: string | null;
  category?: string | null;
  isLive?: boolean;
};

export type UserSearchResult = {
  id: string;
  username: string;
  avatarUrl: string | null;
  category: string | null;
  tags: string[];
  role: string;
};

/** Ricerca utenti per username/tag (min 2 caratteri). Vuoto se troppo corto. */
export async function searchUsers(
  query: string,
  take = 10,
): Promise<UserSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const res = await fetch(
      apiUrl(`/users/search?q=${encodeURIComponent(q)}&take=${take}`),
      { cache: "no-store" },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: UserSearchResult[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

const cache = new Map<string, Promise<PublicUserPreview | null>>();

/** Cache locale (in-memory) per evitare ripetuti GET /users/:id sullo stesso peer. */
export function fetchPublicUser(id: string): Promise<PublicUserPreview | null> {
  const key = id.trim();
  if (!key) return Promise.resolve(null);

  const existing = cache.get(key);
  if (existing) return existing;

  const p = (async () => {
    try {
      const res = await fetch(apiUrl(`/users/${encodeURIComponent(key)}`), {
        cache: "no-store",
      });
      if (!res.ok) return null;
      const data = (await res.json()) as PublicUserPreview & {
        isLive?: boolean;
      };
      return {
        id: data.id,
        username: data.username,
        avatarUrl: data.avatarUrl ?? null,
        category: data.category ?? null,
        isLive: !!data.isLive,
      } satisfies PublicUserPreview;
    } catch {
      return null;
    }
  })();

  cache.set(key, p);
  return p;
}
