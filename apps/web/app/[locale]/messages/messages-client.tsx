"use client";

import Image from "next/image";
import { Link, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch } from "@/services/api";
import { getSocket } from "@/services/socket";
import {
  fetchPublicUser,
  searchUsers,
  type PublicUserPreview,
  type UserSearchResult,
} from "@/services/users";
import { useAppSelector } from "@/store/hooks";
import { formatIsoUtc } from "@/lib/format";
import {
  forgetPeer,
  getRecentPeers,
  rememberPeer,
  type RecentPeer,
} from "@/lib/recent-peers";

type ThreadMsg = {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  mediaUrl: string | null;
  mediaType: "image" | "video" | "file" | null;
  readAt?: string | null;
  createdAt: string;
};

type ConversationRow = {
  peer: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
  lastMessage: ThreadMsg;
};

export function MessagesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const peerId = searchParams.get("peer")?.trim() ?? "";
  const token = useAppSelector((s) => s.auth.token);
  const me = useAppSelector((s) => s.auth.user);

  const [thread, setThread] = useState<ThreadMsg[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video" | "file">(
    "image",
  );
  const [sending, setSending] = useState(false);
  const [peerQuery, setPeerQuery] = useState("");
  const [peerResults, setPeerResults] = useState<UserSearchResult[]>([]);
  const [peerInfo, setPeerInfo] = useState<PublicUserPreview | null>(null);
  const [recents, setRecents] = useState<RecentPeer[]>([]);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [realtime, setRealtime] = useState<"offline" | "connecting" | "live">(
    "offline",
  );
  const peerIdRef = useRef(peerId);
  peerIdRef.current = peerId;

  useEffect(() => {
    setRecents(getRecentPeers());
  }, []);

  const loadConversations = useCallback(async () => {
    if (!token) {
      setConversations([]);
      return;
    }
    const res = await apiFetch("/messages/conversations?take=30");
    if (!res.ok) return;
    const rows = (await res.json()) as ConversationRow[];
    setConversations(rows);
  }, [token]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!token) {
      setRealtime("offline");
      return;
    }
    const socket = getSocket();
    if (!socket) return;

    setRealtime(socket.connected ? "live" : "connecting");
    const onConnect = () => {
      setRealtime("live");
      socket.emit("dm:auth", { accessToken: token });
    };
    const onDisconnect = () => setRealtime("connecting");
    const onMessage = (msg: ThreadMsg) => {
      const currentPeer = peerIdRef.current;
      const belongsToOpenThread =
        currentPeer &&
        (msg.senderId === currentPeer || msg.receiverId === currentPeer);

      if (belongsToOpenThread) {
        setThread((prev) => {
          const list = prev ?? [];
          if (list.some((m) => m.id === msg.id)) return list;
          return [...list, msg];
        });
      }
      void loadConversations();
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("dm:message", onMessage);
    if (!socket.connected) socket.connect();
    else onConnect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("dm:message", onMessage);
    };
  }, [token, loadConversations]);

  useEffect(() => {
    let cancelled = false;
    if (!peerId) {
      setPeerInfo(null);
      return;
    }
    fetchPublicUser(peerId).then((u) => {
      if (cancelled) return;
      setPeerInfo(u);
      if (u) {
        rememberPeer({
          id: u.id,
          username: u.username,
          avatarUrl: u.avatarUrl,
        });
        setRecents(getRecentPeers());
      }
    });
    return () => {
      cancelled = true;
    };
  }, [peerId]);

  const loadThread = useCallback(async () => {
    if (!token || !peerId) {
      setThread(null);
      return;
    }
    setLoadErr(null);
    const res = await apiFetch(`/messages/thread/${peerId}?take=80`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setLoadErr(
        typeof body.message === "string"
          ? body.message
          : `Errore ${res.status}`,
      );
      setThread([]);
      return;
    }
    const rows = (await res.json()) as ThreadMsg[];
    setThread(rows);
  }, [token, peerId]);

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  async function sendMessage() {
    const text = draft.trim();
    const media = mediaUrl.trim();
    if (!token || !peerId || (!text && !media)) return;
    setSending(true);
    setLoadErr(null);
    try {
      const res = await apiFetch("/messages", {
        method: "POST",
        body: JSON.stringify({
          receiverId: peerId,
          content: text,
          mediaUrl: media || undefined,
          mediaType: media ? mediaType : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setLoadErr(
          typeof body.message === "string"
            ? body.message
            : "Invio non riuscito.",
        );
        return;
      }
      setDraft("");
      setMediaUrl("");
      const row = (await res.json()) as ThreadMsg;
      setThread((prev) => {
        const list = prev ?? [];
        if (list.some((m) => m.id === row.id)) return list;
        return [...list, row];
      });
      await loadConversations();
    } finally {
      setSending(false);
    }
  }

  function openPeer(id: string) {
    if (!id) return;
    router.push(`/messages?peer=${encodeURIComponent(id)}`);
  }

  // Live search per username (debounce 250ms)
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const items = await searchUsers(peerQuery, 8);
      if (!cancelled) setPeerResults(items);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [peerQuery]);

  function removeRecent(id: string) {
    forgetPeer(id);
    setRecents(getRecentPeers());
  }

  const peerLabel = peerInfo?.username ?? peerId;

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-3xl flex-col px-4 py-8 lg:px-6">
        <header>
          <h1 className="text-2xl font-bold text-cam-text">Messaggi</h1>
          <p className="mt-2 text-sm text-cam-muted">
            DM tra utenti registrati. Trovi gli utenti dalla pagina{" "}
            <Link href="/discover" className="font-semibold text-cam-orange-bright hover:underline">
              Scopri
            </Link>
            .
          </p>
        </header>

        {!token ? (
          <p className="mt-8 rounded-md border border-cam-border bg-cam-card px-4 py-4 text-sm text-cam-text shadow-card">
            <Link
              href="/login"
              className="font-semibold text-cam-orange-bright hover:underline"
            >
              Accedi
            </Link>{" "}
            per leggere e inviare messaggi.
          </p>
        ) : !peerId ? (
          <div className="mt-8 space-y-6">
            {conversations.length > 0 && (
              <section className="rounded-md border border-cam-border bg-cam-card p-5 shadow-card">
                <h2 className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-cam-muted">
                  <span>Storico chat</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] ${
                      realtime === "live"
                        ? "bg-emerald-600/20 text-emerald-300"
                        : "bg-cam-ink text-cam-muted"
                    }`}
                  >
                    {realtime === "live" ? "Realtime" : "Offline"}
                  </span>
                </h2>
                <ul className="mt-3 space-y-2">
                  {conversations.map((c) => (
                    <li key={c.peer.id}>
                      <Link
                        href={`/messages?peer=${encodeURIComponent(c.peer.id)}`}
                        className="flex items-center gap-3 rounded-md border border-cam-border bg-cam-ink p-2 transition hover:border-cam-orange hover:bg-cam-orange/10"
                      >
                        <PeerAvatar
                          id={c.peer.id}
                          username={c.peer.username}
                          avatarUrl={c.peer.avatarUrl}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-cam-text">
                            {c.peer.username}
                          </span>
                          <span className="block truncate text-[11px] text-cam-muted">
                            {messagePreview(c.lastMessage)}
                          </span>
                        </span>
                        <span className="shrink-0 text-[10px] text-cam-muted">
                          {formatIsoUtc(c.lastMessage.createdAt)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {recents.length > 0 && (
              <section className="rounded-md border border-cam-border bg-cam-card p-5 shadow-card">
                <h2 className="text-xs font-bold uppercase tracking-wider text-cam-muted">
                  Conversazioni recenti
                </h2>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {recents.map((r) => (
                    <li
                      key={r.id}
                      className="group flex items-center gap-3 rounded-md border border-cam-border bg-cam-card p-2 hover:border-cam-orange"
                    >
                      <PeerAvatar id={r.id} username={r.username} avatarUrl={r.avatarUrl} />
                      <Link
                        href={`/messages?peer=${encodeURIComponent(r.id)}`}
                        className="min-w-0 flex-1"
                      >
                        <p className="truncate text-sm font-semibold text-cam-text">
                          {r.username}
                        </p>
                        <p className="truncate text-[11px] text-cam-muted">
                          {formatIsoUtc(new Date(r.ts).toISOString())}
                        </p>
                      </Link>
                      <button
                        type="button"
                        onClick={() => removeRecent(r.id)}
                        aria-label={`Rimuovi ${r.username}`}
                        className="rounded-md p-1 text-xs text-cam-muted opacity-0 transition group-hover:opacity-100 hover:text-cam-text"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="rounded-md border border-cam-border bg-cam-card p-6 shadow-card">
              <h2 className="text-xs font-bold uppercase tracking-wider text-cam-muted">
                Apri una nuova chat
              </h2>
              <p className="mt-2 text-sm text-cam-muted">
                Cerca un utente per username.
              </p>
              <div className="mt-4">
                <input
                  type="search"
                  value={peerQuery}
                  onChange={(e) => setPeerQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && peerResults[0]) {
                      openPeer(peerResults[0].id);
                    }
                  }}
                  placeholder="Cerca username (min 2 caratteri)..."
                  className="w-full rounded-md border border-cam-border bg-cam-card px-3 py-2 text-sm text-cam-text focus:border-cam-orange focus:outline-none focus:ring-2 focus:ring-cam-orange/35"
                />
                {peerQuery.trim().length >= 2 && (
                  <ul className="mt-3 space-y-1">
                    {peerResults.length === 0 ? (
                      <li className="rounded-md bg-cam-ink px-3 py-2 text-xs text-cam-muted">
                        Nessun utente trovato per &quot;{peerQuery.trim()}&quot;.
                      </li>
                    ) : (
                      peerResults.map((u) => (
                        <li key={u.id}>
                          <button
                            type="button"
                            onClick={() => openPeer(u.id)}
                            className="flex w-full items-center gap-3 rounded-md border border-cam-border bg-cam-card p-2 text-left transition hover:border-cam-orange hover:bg-cam-orange/15"
                          >
                            <PeerAvatar
                              id={u.id}
                              username={u.username}
                              avatarUrl={u.avatarUrl}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-cam-text">
                                {u.username}
                              </span>
                              <span className="block truncate text-[11px] text-cam-muted">
                                {u.category ?? u.role}
                              </span>
                            </span>
                            <span className="rounded-full bg-cam-cta px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-cam-ink">
                              Chat
                            </span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            </section>
          </div>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-center gap-3 rounded-md border border-cam-border bg-cam-card p-4 shadow-card">
              <PeerAvatar
                id={peerId}
                username={peerLabel}
                avatarUrl={peerInfo?.avatarUrl ?? null}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-cam-text">
                  {peerLabel}
                </p>
                <p className="truncate text-[11px] text-cam-muted">
                  {peerInfo?.category ?? "Conversazione"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Link
                  href={`/u/${peerId}`}
                  className="rounded-full border border-cam-border px-3 py-1 font-semibold text-cam-muted hover:border-cam-orange hover:text-cam-orange-bright"
                >
                  Profilo
                </Link>
                <Link
                  href={`/live/${peerId}`}
                  className="rounded-full bg-cam-cta px-3 py-1 font-bold uppercase tracking-wide text-cam-ink"
                >
                  Live
                </Link>
                <Link
                  href="/messages"
                  className="rounded-full border border-cam-border px-3 py-1 text-cam-muted hover:text-cam-muted"
                >
                  Cambia
                </Link>
              </div>
            </div>

            {loadErr && (
              <p className="mt-4 rounded-md border border-red-500/35 bg-red-950/40 px-3 py-2 text-xs text-red-200">
                {loadErr}
              </p>
            )}

            <ul className="mt-4 max-h-[55vh] space-y-3 overflow-y-auto rounded-md border border-cam-border bg-cam-card p-4 shadow-card">
              {thread === null ? (
                <li className="text-sm text-cam-muted">Carico…</li>
              ) : !thread.length ? (
                <li className="text-sm text-cam-muted">
                  Nessun messaggio ancora — inizia tu.
                </li>
              ) : (
                thread.map((m) => {
                  const mine = me?.id && m.senderId === me.id;
                  return (
                    <li
                      key={m.id}
                      className={`flex flex-col rounded-md px-3 py-2 text-sm ${
                        mine
                          ? "ml-8 bg-cam-orange/20 text-cam-text ring-1 ring-cam-orange/30"
                          : "mr-8 bg-cam-ink text-cam-text"
                      }`}
                    >
                      <span className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-cam-orange-bright">
                        {mine ? me?.username || "Tu" : peerLabel}
                      </span>
                      <span className="break-words">{m.content}</span>
                      {m.mediaUrl ? (
                        <MessageMedia url={m.mediaUrl} type={m.mediaType} />
                      ) : null}
                      <span className="mt-1 text-[10px] text-cam-muted">
                        {formatIsoUtc(m.createdAt)}
                      </span>
                    </li>
                  );
                })
              )}
            </ul>

            <form
              className="mt-4 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={`Scrivi a ${peerLabel}...`}
                  className="min-w-0 flex-1 rounded-full border border-cam-border bg-cam-card px-3 py-2 text-sm text-cam-text focus:border-cam-orange focus:outline-none focus:ring-2 focus:ring-cam-orange/35"
                />
                <button
                  type="submit"
                  disabled={sending || (!draft.trim() && !mediaUrl.trim())}
                  className="rounded-full bg-cam-cta px-4 py-2 text-sm font-bold uppercase tracking-wide text-cam-ink disabled:opacity-50"
                >
                  {sending ? "Invio..." : "Invia"}
                </button>
              </div>
              <div className="flex flex-col gap-2 rounded-md border border-cam-border bg-cam-card p-2 sm:flex-row">
                <select
                  value={mediaType}
                  onChange={(e) =>
                    setMediaType(e.target.value as "image" | "video" | "file")
                  }
                  className="rounded border border-cam-border bg-cam-ink px-2 py-1 text-xs text-cam-text"
                  aria-label="Tipo media"
                >
                  <option value="image">Foto</option>
                  <option value="video">Video</option>
                  <option value="file">File</option>
                </select>
                <input
                  type="url"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="URL media opzionale (https://...)"
                  className="min-w-0 flex-1 rounded border border-cam-border bg-cam-ink px-2 py-1 text-xs text-cam-text placeholder:text-cam-muted focus:border-cam-orange focus:outline-none"
                />
              </div>
            </form>
          </>
        )}
      </div>
    </AppShell>
  );
}

function messagePreview(m: ThreadMsg) {
  if (m.content?.trim()) return m.content.trim();
  if (m.mediaType === "image") return "Foto";
  if (m.mediaType === "video") return "Video";
  if (m.mediaUrl) return "File";
  return "Messaggio";
}

function MessageMedia({
  url,
  type,
}: {
  url: string;
  type: ThreadMsg["mediaType"];
}) {
  if (type === "image") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 block overflow-hidden rounded-md border border-cam-border bg-black/40"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- URL utente arbitrari, no whitelist remotePatterns */}
        <img
          src={url}
          alt=""
          className="max-h-64 w-full object-contain"
          loading="lazy"
        />
      </a>
    );
  }
  if (type === "video") {
    return (
      <video
        src={url}
        className="mt-2 max-h-64 w-full rounded-md border border-cam-border bg-black"
        controls
      />
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 inline-flex rounded-full border border-cam-border px-3 py-1 text-xs font-semibold text-cam-orange-bright hover:border-cam-orange"
    >
      Apri media
    </a>
  );
}

function PeerAvatar({
  id,
  username,
  avatarUrl,
  size = "sm",
}: {
  id: string;
  username: string;
  avatarUrl: string | null;
  size?: "sm" | "md";
}) {
  const dim = size === "md" ? 44 : 36;
  const src =
    avatarUrl ||
    `https://picsum.photos/seed/${encodeURIComponent(id)}/${dim * 2}/${dim * 2}`;
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-full bg-cam-ink"
      style={{ width: dim, height: dim }}
    >
      <Image
        src={src}
        alt={username}
        fill
        sizes={`${dim}px`}
        className="object-cover"
        unoptimized
      />
    </div>
  );
}
