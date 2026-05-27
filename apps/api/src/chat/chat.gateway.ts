import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Role, ShowMode } from "@prisma/client";
import { Server, Socket } from "socket.io";
import { ModerationService } from "../moderation/moderation.service";
import { PrismaService } from "../prisma/prisma.service";

type ChatPayload = {
  roomId: string;
  user: string;
  message: string;
  moderatorBadge?: boolean;
  /** JWT viewer: obbligatorio per messaggi mentre lo stream è LIVE; in PRIVATE anche anti-spoof e blocco spy. */
  accessToken?: string;
};

type JwtPayloadShape = {
  sub: string;
  role: Role | string;
};

type DirectAuthPayload = {
  accessToken?: string;
};

export type LiveStatePayload = {
  roomId: string;
  chatOpen: boolean;
  showMode: ShowMode;
  currentPrivateViewerId: string | null;
  basePrice: number;
  privatePricePerMinute: number;
  status: "LIVE" | "ENDED";
};

@WebSocketGateway({
  cors: {
    origin:
      process.env.SOCKET_CORS_ORIGIN?.split(",").map((s) => s.trim()).filter(Boolean) ??
      true,
    credentials: true,
  },
})
export class ChatGateway {
  private readonly logger = new Logger(ChatGateway.name);

  /** Anti-spam: finestre sliding per viewer autenticato per stanza */
  private chatTimestamps = new Map<string, number[]>();

  /** Evita ripetizione identica ravvicinata */
  private lastMessageByViewer = new Map<
    string,
    { normalized: string; at: number }
  >();

  /** Messaggi evidenziati con prefisso `! `: al massimo 1 / minuto per utente/stanza */
  private lastHighlightAt = new Map<string, number>();

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly moderation: ModerationService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.debug(`socket ${client.id} connesso`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`socket ${client.id} disconnesso`);
  }

  @SubscribeMessage("joinRoom")
  async joinRoom(@ConnectedSocket() client: Socket, @MessageBody() roomId: string) {
    void client.join(roomId);
    const state = await this.readLiveState(roomId);
    if (state) {
      client.emit("liveState", state);
    }
    return { ok: true };
  }

  @SubscribeMessage("leaveRoom")
  leaveRoom(@ConnectedSocket() client: Socket, @MessageBody() roomId: string) {
    void client.leave(roomId);
    return { ok: true };
  }

  @SubscribeMessage("dm:auth")
  async authDirectMessages(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: DirectAuthPayload,
  ) {
    const rawToken = payload?.accessToken?.trim();
    if (!rawToken) return { ok: false, reason: "token_mancante" };
    try {
      const decoded = this.jwt.verify<JwtPayloadShape>(rawToken);
      const u = await this.prisma.user.findUnique({
        where: { id: decoded.sub },
        select: { id: true, banned: true },
      });
      if (!u || u.banned) return { ok: false, reason: "utente_non_valido" };
      client.data.userId = u.id;
      void client.join(this.userRoom(u.id));
      return { ok: true };
    } catch {
      return { ok: false, reason: "token_non_valido" };
    }
  }

  @SubscribeMessage("chat")
  async chat(@MessageBody() payload: ChatPayload) {
    const roomId = payload?.roomId?.trim();
    const rawMessage = payload?.message ?? "";
    const message = typeof rawMessage === "string" ? rawMessage : String(rawMessage);
    const anonLabel = payload?.user?.trim() || "anon";

    if (!roomId) {
      return { ok: false, reason: "room_mancante" };
    }

    const stream = await this.prisma.stream.findUnique({
      where: { roomId },
      select: {
        chatOpen: true,
        status: true,
        userId: true,
        id: true,
        showMode: true,
        currentPrivateViewerId: true,
      },
    });
    if (stream && stream.status === "LIVE" && stream.chatOpen === false) {
      return { ok: false, reason: "chat_chiusa" };
    }

    let displayUser = anonLabel;
    let moderatorBadge = false;
    let broadcasterBadge = false;
    let outgoingMessage = message.trimEnd();

    /** Utente JWT verificato (potrebbe essere null se token assente/invalido). */
    let authed: {
      userId: string;
      username: string;
      role: Role;
      banned: boolean;
    } | null = null;

    const rawToken = payload?.accessToken?.trim();
    if (rawToken) {
      try {
        const decoded = this.jwt.verify<JwtPayloadShape>(rawToken);
        const u = await this.prisma.user.findUnique({
          where: { id: decoded.sub },
          select: { id: true, username: true, role: true, banned: true },
        });
        if (u && !u.banned) {
          authed = {
            userId: u.id,
            username: u.username,
            role: u.role,
            banned: u.banned,
          };
          displayUser = u.username;
        }
      } catch {
        /* token invalido: trattato come anon salvo regole PRIVATE sotto */
      }
    }

    if (stream?.status === "LIVE") {
      if (!authed) {
        return {
          ok: false,
          reason: rawToken ? "token_non_valido" : "chat_richiede_login",
        };
      }
    }

    // Badge MOD solo per staff reale
    if (payload.moderatorBadge === true && authed) {
      moderatorBadge =
        authed.role === Role.ADMIN || authed.role === Role.MODERATOR;
    }

    if (stream && authed?.userId === stream.userId) {
      broadcasterBadge = true;
    }

    // Premium 1v1: solo streamer, viewer in 1v1, staff — mai gli spy
    if (stream?.status === "LIVE" && stream.showMode === ShowMode.PRIVATE) {
      if (!authed) {
        return { ok: false, reason: "chat_richiede_login" };
      }
      const viewerId = authed.userId;
      if (viewerId === stream.userId) {
        // streamer
      } else if (viewerId === stream.currentPrivateViewerId) {
        // viewer premium
      } else if (authed.role === Role.ADMIN || authed.role === Role.MODERATOR) {
        // moderazione
      } else {
        const spy = await this.prisma.streamAccess.findFirst({
          where: {
            streamId: stream.id,
            viewerId,
            mode: ShowMode.SPY,
            endedAt: null,
          },
          select: { id: true },
        });
        if (spy) {
          return { ok: false, reason: "chat_solo_spy" };
        }
        return { ok: false, reason: "chat_privato_riservato" };
      }
    }

    if (stream?.status === "LIVE" && authed) {
      const rateKey = `${roomId}:${authed.userId}`;
      if (!this.allowChatBurst(rateKey, 11, 10_000)) {
        return { ok: false, reason: "chat_troppo_veloce" };
      }
      const norm = outgoingMessage.trim().toLowerCase();
      if (norm.length > 0) {
        const prev = this.lastMessageByViewer.get(rateKey);
        const now = Date.now();
        if (prev && prev.normalized === norm && now - prev.at < 35_000) {
          return { ok: false, reason: "messaggio_duplicato" };
        }
        this.lastMessageByViewer.set(rateKey, {
          normalized: norm,
          at: now,
        });
      }

      let highlightChat = false;
      const trimmed = outgoingMessage.trimStart();
      if (trimmed.startsWith("!") && trimmed.length > 3) {
        const afterBang = trimmed.slice(1).trimStart();
        if (afterBang.length >= 2 && afterBang.length <= 260) {
          const hlKey = `${roomId}:${authed.userId}`;
          const nowTs = Date.now();
          const lastHl = this.lastHighlightAt.get(hlKey) ?? 0;
          if (nowTs - lastHl >= 60_000) {
            highlightChat = true;
            outgoingMessage = afterBang.trimEnd();
            this.lastHighlightAt.set(hlKey, nowTs);
          }
        }
      }
      const scan = await this.moderation.scanLiveChatForRoom(
        roomId,
        authed.userId,
        outgoingMessage.trim(),
        500,
      );
      if (!scan.ok) {
        return { ok: false, reason: scan.reason };
      }

      this.server.to(roomId).emit("chat", {
        roomId,
        userId: authed.userId,
        user: displayUser,
        message: outgoingMessage.trim(),
        moderatorBadge,
        broadcasterBadge,
        highlight: highlightChat,
      });
      return { ok: true };
    }

    const scanEnded = this.moderation.scanPublicChat(message.trim());
    if (!scanEnded.ok) {
      return { ok: false, reason: scanEnded.reason };
    }

    this.server.to(roomId).emit("chat", {
      roomId,
      userId: authed?.userId ?? null,
      user: displayUser,
      message: outgoingMessage.trim(),
      moderatorBadge,
      broadcasterBadge,
      highlight: false,
    });
    return { ok: true };
  }

  /** Consenti al massimo `max` messaggi in `windowMs` per chiave viewer+stanza */
  private allowChatBurst(key: string, max: number, windowMs: number): boolean {
    const now = Date.now();
    const slice = (this.chatTimestamps.get(key) ?? []).filter(
      (ts) => now - ts < windowMs,
    );
    if (slice.length >= max) {
      return false;
    }
    slice.push(now);
    this.chatTimestamps.set(key, slice);
    return true;
  }

  /** Chiamato dal modulo streams quando lo streamer cambia config (chatOpen, showMode, ecc.). */
  async broadcastLiveState(roomId: string) {
    const state = await this.readLiveState(roomId);
    if (state) this.server.to(roomId).emit("liveState", state);
  }

  /** Broadcast di una tip ricevuta in un live: usato per animazioni + tip line in chat. */
  async broadcastTip(
    roomId: string,
    payload: {
      username: string;
      amount: number;
      streamId: string | null;
      bigTip?: boolean;
    },
  ) {
    if (!roomId) return;
    this.server.to(roomId).emit("tip", {
      roomId,
      username: payload.username,
      amount: payload.amount,
      streamId: payload.streamId,
      bigTip: payload.bigTip === true,
      ts: Date.now(),
    });
  }

  broadcastPrivateRequest(
    roomId: string,
    payload: {
      requestId: string;
      viewerId: string;
      viewerUsername: string;
      tokensPerMinute: number;
      exclusive: boolean;
      expiresAt: Date;
    },
  ) {
    if (!roomId) return;
    this.server.to(roomId).emit("privateRequest", {
      roomId,
      requestId: payload.requestId,
      viewerId: payload.viewerId,
      viewerUsername: payload.viewerUsername,
      tokensPerMinute: payload.tokensPerMinute,
      exclusive: payload.exclusive,
      expiresAt: payload.expiresAt.toISOString(),
      ts: Date.now(),
    });
  }

  emitDirectMessage(
    senderId: string,
    receiverId: string,
    message: {
      id: string;
      senderId: string;
      receiverId: string;
      content: string;
      mediaUrl: string | null;
      mediaType: string | null;
      readAt: string | null;
      createdAt: string;
    },
  ) {
    this.server.to(this.userRoom(senderId)).emit("dm:message", message);
    if (receiverId !== senderId) {
      this.server.to(this.userRoom(receiverId)).emit("dm:message", message);
    }
  }

  private userRoom(userId: string) {
    return `user:${userId}`;
  }

  private async readLiveState(roomId: string): Promise<LiveStatePayload | null> {
    if (!roomId) return null;
    const s = await this.prisma.stream.findUnique({
      where: { roomId },
      select: {
        roomId: true,
        chatOpen: true,
        showMode: true,
        currentPrivateViewerId: true,
        basePrice: true,
        privatePricePerMinute: true,
        status: true,
      },
    });
    if (!s || !s.roomId) return null;
    return {
      roomId: s.roomId,
      chatOpen: s.chatOpen,
      showMode: s.showMode,
      currentPrivateViewerId: s.currentPrivateViewerId,
      basePrice: s.basePrice,
      privatePricePerMinute: s.privatePricePerMinute,
      status: s.status === "LIVE" ? "LIVE" : "ENDED",
    };
  }
}
