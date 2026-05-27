const KEY = "synthra:recent-peers";
const MAX = 8;

export type RecentPeer = {
  id: string;
  username: string;
  avatarUrl: string | null;
  ts: number;
};

function read(): RecentPeer[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentPeer[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p) =>
        p && typeof p.id === "string" && typeof p.username === "string",
    );
  } catch {
    return [];
  }
}

function write(items: RecentPeer[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  } catch {
    /* noop quota */
  }
}

export function getRecentPeers(): RecentPeer[] {
  return read().sort((a, b) => b.ts - a.ts);
}

export function rememberPeer(p: Omit<RecentPeer, "ts">) {
  if (!p.id) return;
  const items = read().filter((x) => x.id !== p.id);
  items.unshift({ ...p, ts: Date.now() });
  write(items);
}

export function forgetPeer(id: string) {
  write(read().filter((x) => x.id !== id));
}
