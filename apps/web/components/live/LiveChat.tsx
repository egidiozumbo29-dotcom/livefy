"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { useAppSelector } from "@/store/hooks";
import { apiFetch, getStoredToken } from "@/services/api";
import { TipMenuDialog } from "./TipMenuDialog";

type ChatMsg = {
  id: string;
  userId?: string | null;
  user: string;
  message: string;
  moderatorBadge?: boolean;
  broadcasterBadge?: boolean;
  highlight?: boolean;
  mine?: boolean;
  /** Tip line quando presente. */
  tip?: number;
  bigTip?: boolean;
  privateRequest?: {
    requestId: string;
    viewerId: string;
    tokensPerMinute: number;
    exclusive: boolean;
  };
};

type DirectMsg = {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
};

type PrivateRequestRow = {
  id: string;
  viewer: { id: string; username: string };
  tokensPerMinute: number;
  exclusive: boolean;
};

type ChatStatus = "idle" | "connecting" | "online" | "error";

type LiveStatePayload = {
  roomId: string;
  chatOpen: boolean;
  showMode: "PUBLIC" | "BASE" | "PRIVATE";
  currentPrivateViewerId?: string | null;
  basePrice: number;
  privatePricePerMinute: number;
  status: "LIVE" | "ENDED";
};

const MAX_MESSAGES = 120;

/** Emoji rapidi nella tendina composer (Unicode). */
const CHAT_QUICK_EMOJI = [
  "😂",
  "😍",
  "🔥",
  "😊",
  "👏",
  "❤️",
  "😈",
  "🙏",
  "💦",
  "✨",
  "🎉",
  "💎",
  "👀",
  "🍑",
  "💋",
  "🥵",
  "😭",
  "🤝",
  "⚡",
  "💅",
];

function hslForUsername(name: string): string {
  let h = 5381;
  for (let i = 0; i < name.length; i++) {
    h = Math.imul(h ^ name.charCodeAt(i), 0x01000193);
  }
  const hue = ((h >>> 0) % 360) || 212;
  return `hsl(${hue}, 78%, 64%)`;
}

function splitWithUrls(text: string): Array<{ kind: "text" | "url"; value: string }> {
  const out: Array<{ kind: "text" | "url"; value: string }> = [];
  const re = /https:\/\/[^\s]+/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const start = m.index;
    if (start > last) {
      out.push({ kind: "text", value: text.slice(last, start) });
    }
    out.push({ kind: "url", value: m[0] });
    last = start + m[0].length;
  }
  if (last < text.length) {
    out.push({ kind: "text", value: text.slice(last) });
  }
  return out.length ? out : [{ kind: "text", value: text }];
}

function approvedMediaEmbedded(urlRaw: string): "gif" | "mp4" | null {
  let u: URL;
  try {
    u = new URL(urlRaw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase();
  const path = u.pathname.toLowerCase();

  if (host.endsWith(".tenor.com")) {
    if (path.endsWith(".mp4")) return "mp4";
    if (path.endsWith(".gif") || path.endsWith(".webp")) return "gif";
    return null;
  }
  if (/^media\d*\.giphy\.com$/i.test(host)) {
    if (path.endsWith(".gif") || path.endsWith(".webp")) return "gif";
    return null;
  }
  if (host === "i.giphy.com" && /\.(gif|webp)$/i.test(path)) return "gif";
  return null;
}

function ChatMessagePieces({ body }: { body: string }) {
  const parts = splitWithUrls(body);
  return (
    <>
      {parts.map((p, ix) =>
        p.kind === "text" ? (
          <span key={`t:${ix}:${p.value.length}:${p.value.slice(0, 12)}`}>
            {p.value}
          </span>
        ) : (
          <EmbeddedMediaOrLink key={`u-${ix}-${p.value.slice(-24)}`} url={p.value} />
        ),
      )}
    </>
  );
}

function EmbeddedMediaOrLink({ url }: { url: string }) {
  const kind = approvedMediaEmbedded(url);
  if (kind === "gif") {
    return (
      <span className="my-1 block max-w-full overflow-hidden rounded-md border border-white/10 bg-black/50">
        {/* eslint-disable-next-line @next/next/no-img-element -- URL utente arbitrari, no whitelist remotePatterns */}
        <img
          src={url}
          alt=""
          className="max-h-36 max-w-full rounded object-contain"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </span>
    );
  }
  if (kind === "mp4") {
    return (
      <span className="my-1 block max-w-[min(280px,100%)] overflow-hidden rounded-md border border-white/10 bg-black">
        <video
          src={url}
          muted
          loop
          playsInline
          autoPlay
          className="max-h-36 w-full object-contain"
        />
      </span>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="break-all text-sky-300 underline underline-offset-2 hover:text-sky-100"
    >
      {url}
    </a>
  );
}

function getWsUrl(): string {
  const env = process.env.NEXT_PUBLIC_WS_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  return "http://127.0.0.1:4000";
}

type LiveChatProps = {
  roomId: string;
  creatorId?: string;
  streamId?: string | null;
  showMode?: "PUBLIC" | "BASE" | "PRIVATE";
  privatePeerId?: string | null;
  enforceLogin?: boolean;
  fillColumn?: boolean;
};

function dispatchTipEvent(detail: {
  username: string;
  amount: number;
  streamId: string | null;
  bigTip?: boolean;
}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("synthra:tip", { detail }));
}

export function LiveChat({
  roomId,
  creatorId,
  streamId,
  showMode = "PUBLIC",
  privatePeerId = null,
  enforceLogin = false,
  fillColumn = false,
}: LiveChatProps) {
  const tc = useTranslations("liveChat");
  const me = useAppSelector((s) => s.auth.user);
  const isStreamer =
    me?.role === "MODEL" || me?.role === "ADMIN" || me?.id === creatorId;
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [activeTab, setActiveTab] = useState<"public" | "private">("public");
  const [privateMessages, setPrivateMessages] = useState<DirectMsg[]>([]);
  const [liveShowMode, setLiveShowMode] = useState(showMode);
  const [livePrivateViewerId, setLivePrivateViewerId] = useState<string | null>(
    null,
  );
  const [selectedPrivatePeerId, setSelectedPrivatePeerId] = useState<string | null>(
    null,
  );
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(true);
  const [tipOpen, setTipOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [userMenu, setUserMenu] = useState<{
    userId: string;
    username: string;
    privateLocked?: boolean;
  } | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const composerWrapRef = useRef<HTMLDivElement | null>(null);

  const tcRef = useRef(tc);
  tcRef.current = tc;
  const resolvedPrivatePeerId = me
    ? selectedPrivatePeerId ??
      (isStreamer ? livePrivateViewerId ?? privatePeerId : privatePeerId ?? creatorId ?? null)
    : null;
  const privateAvailable =
    !!me &&
    !!resolvedPrivatePeerId &&
    resolvedPrivatePeerId !== me.id;

  useEffect(() => {
    setLiveShowMode(showMode);
    setLivePrivateViewerId((prev) =>
      privatePeerId && isStreamer ? privatePeerId : prev,
    );
  }, [showMode, privatePeerId, isStreamer]);

  useEffect(() => {
    if (!privateAvailable && activeTab === "private") {
      setActiveTab("public");
    }
  }, [activeTab, privateAvailable]);

  function ackToMessage(reason?: string): string {
    const t = tcRef.current;
    switch (reason) {
      case "chat_richiede_login":
        return t("reasonLogin");
      case "chat_solo_spy":
        return t("reasonSpy");
      case "chat_privato_riservato":
        return t("reasonPremium");
      case "show_premium_esclusivo":
        return t("reasonExclusive");
      case "token_non_valido":
        return t("reasonBadToken");
      case "chat_chiusa":
        return t("reasonClosed");
      case "chat_troppo_veloce":
        return t("reasonTooFast");
      case "messaggio_duplicato":
        return t("reasonDuplicate");
      case "messaggio_troppo_lungo":
      case "contenuto_sospetto":
      case "spam_ripetitivo":
      case "troppi_link":
        return t("reasonModeration");
      default:
        return reason ? t("reasonBlockedWith", { reason }) : t("reasonBlocked");
    }
  }

  useEffect(() => {
    function docClick(ev: MouseEvent) {
      const root = composerWrapRef.current;
      if (!root || emojiOpen === false) return;
      const t = ev.target;
      if (t instanceof Node && !root.contains(t)) setEmojiOpen(false);
    }
    document.addEventListener("mousedown", docClick);
    return () => document.removeEventListener("mousedown", docClick);
  }, [emojiOpen]);

  useEffect(() => {
    let cancelled = false;
    setStatus("connecting");
    setError(null);

    (async () => {
      const { io } = await import("socket.io-client");
      if (cancelled) return;

      const socket = io(getWsUrl(), {
        transports: ["websocket", "polling"],
        reconnectionAttempts: 5,
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        if (cancelled) return;
        setStatus("online");
        socket.emit("joinRoom", roomId);
      });
      socket.on("connect_error", (err) => {
        if (cancelled) return;
        setStatus("error");
        setError(err.message || tcRef.current("connectError"));
      });
      socket.on("disconnect", () => {
        if (cancelled) return;
        setStatus("connecting");
      });
      socket.on(
        "chat",
        (payload: {
          roomId: string;
          userId?: string | null;
          user: string;
          message: string;
          moderatorBadge?: boolean;
          broadcasterBadge?: boolean;
          highlight?: boolean;
        }) => {
          if (payload.roomId !== roomId) return;
          setMessages((prev) => {
            const next = [
              ...prev,
              {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                userId: payload.userId ?? null,
                user: payload.user,
                message: payload.message,
                moderatorBadge: payload.moderatorBadge === true,
                broadcasterBadge: payload.broadcasterBadge === true,
                highlight: payload.highlight === true,
                mine: !!me && payload.user === me.username,
              },
            ];
            return next.slice(-MAX_MESSAGES);
          });
        },
      );
      socket.on("liveState", (payload: LiveStatePayload) => {
        if (payload.roomId !== roomId) return;
        setChatOpen(payload.chatOpen !== false);
        setLiveShowMode(payload.showMode);
        setLivePrivateViewerId(payload.currentPrivateViewerId ?? null);
      });
      socket.on(
        "tip",
        (payload: {
          roomId: string;
          username: string;
          amount: number;
          streamId: string | null;
          bigTip?: boolean;
        }) => {
          if (payload.roomId !== roomId) return;
          setMessages((prev) => {
            const next = [
              ...prev,
              {
                id: `tip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                user: payload.username,
                message: `${payload.amount}`,
                tip: payload.amount,
                bigTip: payload.bigTip === true,
                mine: !!me && payload.username === me.username,
              } as ChatMsg,
            ];
            return next.slice(-MAX_MESSAGES);
          });
          dispatchTipEvent({
            username: payload.username,
            amount: payload.amount,
            streamId: payload.streamId,
            bigTip: payload.bigTip === true,
          });
          setAnnouncement(
            tcRef.current("tipScreenReader", {
              user: payload.username,
              tokens: payload.amount,
            }),
          );
        },
      );
      socket.on(
        "privateRequest",
        (payload: {
          roomId: string;
          requestId: string;
          viewerId: string;
          viewerUsername: string;
          tokensPerMinute: number;
          exclusive: boolean;
        }) => {
          if (payload.roomId !== roomId) return;
          setMessages((prev) => {
            const next = [
              ...prev,
              {
                id: `private-request-${payload.requestId}`,
                user: payload.viewerUsername,
                message: payload.exclusive
                  ? "richiede un private show esclusivo"
                  : "richiede un private show normale",
                privateRequest: {
                  requestId: payload.requestId,
                  viewerId: payload.viewerId,
                  tokensPerMinute: payload.tokensPerMinute,
                  exclusive: payload.exclusive,
                },
                mine: !!me && payload.viewerUsername === me.username,
              } as ChatMsg,
            ];
            return next.slice(-MAX_MESSAGES);
          });
        },
      );
    })();

    return () => {
      cancelled = true;
      const s = socketRef.current;
      if (s) {
        try {
          s.emit("leaveRoom", roomId);
        } catch {
          /* noop */
        }
        s.removeAllListeners();
        s.disconnect();
      }
      socketRef.current = null;
    };
  }, [roomId, me]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, privateMessages.length, activeTab]);

  useEffect(() => {
    if (!isStreamer) return;
    let cancelled = false;
    const loadRequests = async () => {
      const res = await apiFetch("/streams/private/requests");
      if (!res.ok || cancelled) return;
      const rows = (await res.json()) as PrivateRequestRow[];
      setMessages((prev) => {
        let next = prev;
        for (const row of rows) {
          const id = `private-request-${row.id}`;
          if (next.some((m) => m.id === id)) continue;
          next = [
            ...next,
            {
              id,
              userId: row.viewer.id,
              user: row.viewer.username,
              message: row.exclusive
                ? "richiede un private show esclusivo"
                : "richiede un private show normale",
              privateRequest: {
                requestId: row.id,
                viewerId: row.viewer.id,
                tokensPerMinute: row.tokensPerMinute,
                exclusive: row.exclusive,
              },
            } as ChatMsg,
          ];
        }
        return next.slice(-MAX_MESSAGES);
      });
    };
    void loadRequests();
    const id = window.setInterval(() => void loadRequests(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isStreamer]);

  useEffect(() => {
    if (!privateAvailable || activeTab !== "private" || !resolvedPrivatePeerId) return;
    let cancelled = false;
    const loadPrivateThread = async () => {
      const res = await apiFetch(
        `/messages/thread/${encodeURIComponent(resolvedPrivatePeerId)}?take=80`,
      );
      if (!res.ok || cancelled) return;
      const rows = (await res.json()) as DirectMsg[];
      setPrivateMessages(rows);
    };
    void loadPrivateThread();
    const id = window.setInterval(() => void loadPrivateThread(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [activeTab, privateAvailable, resolvedPrivatePeerId]);

  function sendMessage() {
    const text = draft.trim();
    if (!text) return;
    if (activeTab === "private") {
      void sendPrivateMessage(text);
      return;
    }
    const s = socketRef.current;
    if (!s || status !== "online") return;
    s.emit(
      "chat",
      {
        roomId,
        user: me?.username || "anon",
        message: text,
        accessToken: getStoredToken() ?? undefined,
      },
      (ack: { ok?: boolean; reason?: string }) => {
        if (ack && ack.ok === false) {
          setError(ackToMessage(ack.reason));
        }
      },
    );
    setDraft("");
  }

  async function sendPrivateMessage(text: string) {
    if (!privateAvailable || !resolvedPrivatePeerId) {
      setError("Chat privata non disponibile.");
      return;
    }
    const res = await apiFetch("/messages", {
      method: "POST",
      body: JSON.stringify({ receiverId: resolvedPrivatePeerId, content: text }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(
        typeof body.message === "string"
          ? body.message
          : "Invio privato non riuscito.",
      );
      return;
    }
    const row = (await res.json()) as DirectMsg;
    setPrivateMessages((prev) =>
      prev.some((m) => m.id === row.id) ? prev : [...prev, row],
    );
    setDraft("");
  }

  function insertEmoji(ch: string) {
    setDraft((d) => (d ? `${d}${ch}` : ch));
    setEmojiOpen(false);
  }

  async function answerPrivateRequest(requestId: string, accept: boolean) {
    const res = await apiFetch(
      `/streams/private/requests/${encodeURIComponent(requestId)}/${accept ? "accept" : "reject"}`,
      { method: "POST" },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(
        typeof body.message === "string"
          ? body.message
          : "Operazione non riuscita.",
      );
      return;
    }
    setMessages((prev) =>
      prev.map((m) =>
        m.privateRequest?.requestId === requestId
          ? {
              ...m,
              message: accept
                ? `${m.message} · accettata`
                : `${m.message} · rifiutata`,
              privateRequest: undefined,
            }
          : m,
      ),
    );
    if (accept) {
      window.setTimeout(() => window.location.reload(), 400);
    }
  }

  async function moderateChatUser(action: "ban" | "lock" | "unlock") {
    if (!userMenu) return;
    const targetId = userMenu.userId;
    const endpoint =
      action === "ban"
        ? `/moderation/users/${encodeURIComponent(targetId)}/ban`
        : `/messages/private-chat/${encodeURIComponent(targetId)}/${action}`;
    const res = await apiFetch(endpoint, {
      method: "POST",
      body:
        action === "ban"
          ? JSON.stringify({ reason: "ban_da_chat_live" })
          : undefined,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(
        typeof body.message === "string"
          ? body.message
          : "Operazione non riuscita.",
      );
      return;
    }
    setError(
      action === "ban"
        ? `${userMenu.username} bannato dalla live.`
        : action === "lock"
          ? `Chat privata bloccata per ${userMenu.username}.`
          : `Chat privata sbloccata per ${userMenu.username}.`,
    );
    if (action === "ban") {
      setUserMenu(null);
      return;
    }
    setUserMenu({
      ...userMenu,
      privateLocked: action === "lock",
    });
  }

  async function openUserMenu(userId: string, username: string) {
    const next = { userId, username };
    setSelectedPrivatePeerId(userId);
    setUserMenu(next);
    const res = await apiFetch(
      `/messages/private-chat/${encodeURIComponent(userId)}/status`,
    );
    if (!res.ok) return;
    const body = (await res.json()) as { locked?: boolean };
    setUserMenu({ ...next, privateLocked: body.locked === true });
  }

  const loginWall = enforceLogin && !me;
  const composerDisabled =
    activeTab === "private"
      ? loginWall || !resolvedPrivatePeerId
      : !chatOpen || loginWall || status !== "online";

  const statusDot =
    status === "online"
      ? "bg-emerald-500"
      : status === "error"
        ? "bg-red-500"
        : "bg-cam-muted";

  return (
    <div
      className={`flex min-h-0 flex-col rounded-md border border-cam-border bg-cam-card shadow-[0_4px_24px_rgba(0,0,0,0.45)] ${
        fillColumn ? "h-full max-h-full" : "min-h-[420px] h-full"
      }`}
    >
      <span className="sr-only" role="status" aria-live="assertive">
        {announcement}
      </span>
      <header className="flex items-center justify-between border-b border-cam-border bg-cam-ink px-3 py-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-violet-custom">
          {showMode === "PRIVATE" ? tc("privateTitle") : tc("title")}
        </h2>
        <span className="flex items-center gap-1.5 text-[11px] text-violet-custom">
          <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
          {status === "online"
            ? tc("statusOnline")
            : status === "error"
              ? tc("statusOffline")
              : tc("statusDots")}
        </span>
      </header>

      {loginWall && chatOpen && showMode === "PRIVATE" && (
        <div className="m-2 rounded-md border border-cam-orange/30 bg-cam-orange/10 px-3 py-2 text-[11px] text-cam-text">
          {tc.rich("privateLoginHint", {
            strong: (c) => <strong>{c}</strong>,
          })}
        </div>
      )}

      {loginWall && chatOpen && showMode !== "PRIVATE" && (
        <div className="m-2 rounded-md border border-cam-orange/30 bg-cam-orange/10 px-3 py-2 text-[11px] text-cam-text">
          {tc.rich("genericLoginHint", {
            strong: (c) => <strong>{c}</strong>,
          })}
        </div>
      )}

      {!chatOpen && (
        <div className="m-2 rounded-md border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-[11px] text-amber-100">
          {tc("chatDisabledBanner")}
        </div>
      )}

      <div className="m-2 rounded-md border border-cam-border/80 bg-cam-ink px-3 py-1.5 text-[10px] leading-snug text-violet-custom">
        {tc.rich(showMode === "PRIVATE" ? "privateChatHint" : "publicChatHint", {
          strong: (c) => <strong className="text-cam-text">{c}</strong>,
        })}
      </div>

      <div className="mx-2 mb-1 grid grid-cols-2 rounded-full border border-cam-border bg-cam-ink p-1 text-[11px] font-bold uppercase">
        <button
          type="button"
          onClick={() => setActiveTab("public")}
          className={`rounded-full px-3 py-1.5 ${
            activeTab === "public"
              ? "bg-cam-orange text-cam-ink"
              : "text-cam-muted hover:text-cam-text"
          }`}
        >
          Pubblica
        </button>
        <button
          type="button"
          disabled={!privateAvailable && !isStreamer}
          onClick={() => setActiveTab("private")}
          className={`rounded-full px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40 ${
            activeTab === "private"
              ? "bg-cam-orange text-cam-ink"
              : "text-cam-muted hover:text-cam-text"
          }`}
        >
          Privata
        </button>
      </div>

      <ul
        ref={listRef}
        className="flex-1 space-y-1 overflow-y-auto px-3 py-2 text-sm"
        aria-live="polite"
      >
        {activeTab === "private" ? (
          !resolvedPrivatePeerId && isStreamer ? (
            <li className="rounded-md border border-cam-border bg-cam-ink px-3 py-2 text-xs text-violet-custom">
              Clicca sul nome di uno spettatore nella chat pubblica e scegli
              Apri privata.
            </li>
          ) : privateMessages.length === 0 ? (
            <li className="text-xs text-violet-custom">
              Nessun messaggio privato in questa sessione.
            </li>
          ) : (
            privateMessages.map((m) => {
              const mine = !!me && m.senderId === me.id;
              return (
                <li
                  key={m.id}
                  className={`rounded px-2 py-1.5 ${
                    mine
                      ? "ml-8 bg-cam-orange/15 text-violet-custom"
                      : "mr-8 bg-cam-bg/90 text-violet-custom"
                  }`}
                >
                  <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-cam-orange-bright">
                    {mine ? "Tu" : "Privata"}
                  </span>
                  <span className="break-words text-violet-custom">{m.content}</span>
                </li>
              );
            })
          )
        ) : messages.length === 0 ? (
          <li className="text-xs text-violet-custom">{tc("emptyPlaceholder")}</li>
        ) : (
          messages.map((m) => {
            if (m.tip != null) {
              const big = m.bigTip === true;
              return (
                <li
                  key={m.id}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm shadow-inner ${
                    big
                      ? "border border-amber-400/45 bg-gradient-to-r from-amber-950/80 via-orange-950/70 to-purple-950/70 ring-1 ring-amber-300/35"
                      : "border border-cam-orange/30 bg-cam-ink"
                  }`}
                >
                  <span className="text-base">{big ? "💎" : "🚀"}</span>
                  <span className="flex-1 truncate">
                    <span
                      className="font-bold text-cam-orange-bright"
                      style={{ color: hslForUsername(m.user) }}
                    >
                      {m.user}
                    </span>{" "}
                    <span className="text-violet-custom">{tc("tipped")}</span>{" "}
                    <span className="font-bold text-cam-orange-bright">
                      {m.tip} {tc("tokenLabel")}
                    </span>
                  </span>
                </li>
              );
            }
            if (m.privateRequest) {
              return (
                <li
                  key={m.id}
                  className="rounded-md border border-cam-orange/40 bg-cam-orange/10 px-3 py-2 text-xs text-violet-custom"
                >
                  <p>
                    <strong className="text-violet-custom">{m.user}</strong>{" "}
                    {m.message} ·{" "}
                    <strong>{m.privateRequest.tokensPerMinute} tk/min</strong>
                  </p>
                  {isStreamer && (
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPrivatePeerId(m.privateRequest!.viewerId);
                          setActiveTab("private");
                        }}
                        className="rounded-full border border-cam-orange/60 px-3 py-1 text-[11px] font-bold uppercase text-cam-orange-bright"
                      >
                        Apri privata
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void answerPrivateRequest(
                            m.privateRequest!.requestId,
                            true,
                          )
                        }
                        className="rounded-full bg-cam-cta px-3 py-1 text-[11px] font-bold uppercase text-cam-ink"
                      >
                        Accetta
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void answerPrivateRequest(
                            m.privateRequest!.requestId,
                            false,
                          )
                        }
                        className="rounded-full border border-cam-border px-3 py-1 text-[11px] font-semibold text-cam-muted hover:border-red-400 hover:text-red-300"
                      >
                        Rifiuta
                      </button>
                    </div>
                  )}
                </li>
              );
            }
            return (
              <li
                key={m.id}
                className={`rounded px-2 py-1.5 ${
                  m.highlight === true
                    ? "border border-amber-400/35 bg-gradient-to-r from-amber-950/50 to-transparent ring-1 ring-amber-200/40"
                    : ""
                } ${
                  m.mine === true && !m.highlight
                    ? "bg-cam-orange/15 ring-1 ring-cam-orange/30"
                    : m.highlight !== true
                      ? "bg-cam-bg/90"
                      : "bg-transparent"
                }`}
              >
                <span className="mr-2 align-top text-[12px] font-bold">
                  <span
                    role={isStreamer && m.userId ? "button" : undefined}
                    tabIndex={isStreamer && m.userId ? 0 : undefined}
                    onClick={() =>
                      isStreamer && m.userId
                        ? void openUserMenu(m.userId, m.user)
                        : undefined
                    }
                    onKeyDown={(e) => {
                      if (!isStreamer || !m.userId) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        void openUserMenu(m.userId, m.user);
                      }
                    }}
                    className={isStreamer && m.userId ? "cursor-pointer underline-offset-2 hover:underline" : undefined}
                    style={{ color: hslForUsername(m.user) }}
                  >
                    {m.user}
                  </span>
                  {m.moderatorBadge === true ? (
                    <span
                      className="ml-1 rounded bg-amber-600/85 px-1 text-[9px] font-black uppercase tracking-tight text-amber-50"
                      title={tc("badgeModerator")}
                    >
                      MOD
                    </span>
                  ) : null}
                  {m.broadcasterBadge === true ? (
                    <span
                      className="ml-1 rounded bg-fuchsia-600/85 px-1 text-[9px] font-black uppercase tracking-tight text-fuchsia-50"
                      title={tc("badgeHost")}
                    >
                      HOST
                    </span>
                  ) : null}
                </span>
                <span className="break-words text-violet-custom">
                  <ChatMessagePieces body={m.message} />
                </span>
              </li>
            );
          })
        )}
      </ul>

      {error && (
        <p className="mx-3 mb-2 rounded border border-red-500/30 bg-red-950/50 px-2 py-1 text-[11px] text-violet-custom">
          {error}
        </p>
      )}

      {userMenu && (
        <div className="mx-3 mb-2 rounded-md border border-cam-border bg-cam-ink p-3 text-xs text-violet-custom">
          <div className="mb-2 flex items-center justify-between gap-2">
            <strong>{userMenu.username}</strong>
            <button
              type="button"
              onClick={() => setUserMenu(null)}
              className="text-cam-muted hover:text-violet-custom"
            >
              Chiudi
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void moderateChatUser("ban")}
              className="rounded-full border border-red-500/50 px-3 py-1 font-semibold text-red-300 hover:bg-red-500/10"
            >
              Banna
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedPrivatePeerId(userMenu.userId);
                setActiveTab("private");
                setUserMenu(null);
              }}
              className="rounded-full border border-cam-orange/60 px-3 py-1 font-semibold text-cam-orange-bright hover:bg-cam-orange/10"
            >
              Apri privata
            </button>
            <button
              type="button"
              onClick={() =>
                void moderateChatUser(
                  userMenu.privateLocked === true ? "unlock" : "lock",
                )
              }
              className={
                userMenu.privateLocked === true
                  ? "rounded-full border border-emerald-500/50 px-3 py-1 font-semibold text-emerald-300 hover:bg-emerald-500/10"
                  : "rounded-full border border-cam-border px-3 py-1 font-semibold text-cam-text hover:border-cam-orange"
              }
            >
              {userMenu.privateLocked === true
                ? "Sblocca chat privata"
                : "Blocca chat privata"}
            </button>
          </div>
        </div>
      )}

      <div className="border-t border-cam-border bg-cam-ink px-3 pb-2 pt-2">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
        >
          {creatorId && (
            <button
              type="button"
              onClick={() => setTipOpen(true)}
              className="shrink-0 rounded-full bg-cam-cta px-3 py-2 text-xs font-bold uppercase tracking-wide text-white transition hover:opacity-95"
              aria-label={tc("tipAria")}
              title={tc("tipTitle")}
            >
              ⚡ Tip
            </button>
          )}
          <div className="relative shrink-0" ref={composerWrapRef}>
            <button
              type="button"
              disabled={composerDisabled}
              onClick={() => setEmojiOpen((v) => !v)}
              className="rounded-full border border-cam-border bg-cam-bg px-3 py-2 text-sm disabled:opacity-50"
              aria-expanded={emojiOpen}
              aria-label={tc("emojiPickerAria")}
            >
              🙂
            </button>
            {emojiOpen ? (
              <div
                className="absolute bottom-full left-0 z-[50] mb-2 w-[208px] rounded-lg border border-cam-border bg-cam-card p-2 shadow-xl"
                role="listbox"
              >
                <div className="grid grid-cols-5 gap-1">
                  {CHAT_QUICK_EMOJI.map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      className="flex h-9 items-center justify-center rounded hover:bg-white/10"
                      onClick={() => insertEmoji(ch)}
                    >
                      <span className="text-xl">{ch}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={500}
            disabled={composerDisabled}
            placeholder={
              !chatOpen
                ? tc("placeholderClosed")
                : loginWall
                  ? tc("placeholderLogin")
                  : me
                    ? tc("placeholderWrite")
                    : tc("placeholderAnon")
            }
            className="min-w-0 flex-1 rounded-full border border-cam-border bg-cam-bg px-3 py-2 text-sm text-violet-custom placeholder:text-cam-muted focus:border-cam-orange focus:outline-none focus:ring-2 focus:ring-cam-orange/35 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={composerDisabled || !draft.trim()}
            className="rounded-full bg-cam-orange px-4 py-2 text-xs font-bold uppercase tracking-wide text-cam-ink disabled:opacity-50"
          >
            {tc("send")}
          </button>
        </form>
        <p className="mt-2 text-[10px] leading-snug text-violet-custom">{tc("footerHints")}</p>
      </div>

      {creatorId && (
        <TipMenuDialog
          open={tipOpen}
          creatorId={creatorId}
          streamId={streamId ?? null}
          onClose={() => setTipOpen(false)}
        />
      )}
    </div>
  );
}
