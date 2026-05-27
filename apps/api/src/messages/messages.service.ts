import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Role } from "@prisma/client";
import { ChatGateway } from "../chat/chat.gateway";
import { ModerationService } from "../moderation/moderation.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import type { SendMessageDto } from "./dto/send-message.dto";

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
    private readonly chat: ChatGateway,
    private readonly notifications: NotificationsService,
  ) {}

  async send(senderId: string, dto: SendMessageDto) {
    const content = (dto.content ?? "").trim();
    const mediaUrl = dto.mediaUrl?.trim() || null;
    const mediaType = mediaUrl ? (dto.mediaType ?? "file") : null;

    if (!content && !mediaUrl) {
      throw new BadRequestException("messaggio_vuoto");
    }

    const scan = this.moderation.scanPublicChat(content || "[media]");
    if (!scan.ok) {
      throw new ForbiddenException(scan.reason ?? "moderazione");
    }

    const [sender, recv] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: senderId },
        select: { id: true, username: true, banned: true, role: true },
      }),
      this.prisma.user.findUnique({
        where: { id: dto.receiverId },
        select: { id: true, username: true, banned: true, role: true },
      }),
    ]);
    if (!sender || sender.banned) throw new ForbiddenException();
    if (!recv || recv.banned) throw new ForbiddenException();

    const creatorId =
      recv.role === Role.MODEL || recv.role === Role.ADMIN
        ? recv.id
        : sender.role === Role.MODEL || sender.role === Role.ADMIN
          ? sender.id
          : null;
    const viewerId =
      creatorId === recv.id
        ? sender.id
        : creatorId === sender.id
          ? recv.id
          : null;
    if (creatorId && viewerId) {
      const control = await this.prisma.privateChatControl.findUnique({
        where: { creatorId_viewerId: { creatorId, viewerId } },
        select: { locked: true },
      });
      if (control?.locked && senderId === viewerId) {
        throw new ForbiddenException("chat_privata_bloccata");
      }
    }

    const row = await this.prisma.message.create({
      data: {
        senderId,
        receiverId: dto.receiverId,
        content,
        mediaUrl,
        mediaType,
      },
      select: {
        id: true,
        content: true,
        mediaUrl: true,
        mediaType: true,
        createdAt: true,
        receiverId: true,
        senderId: true,
      },
    });

    const payload = this.mapMessage(row);
    this.chat.emitDirectMessage(senderId, dto.receiverId, payload);
    await this.notifications.notifyDirectMessage({
      senderId,
      receiverId: dto.receiverId,
      senderUsername: sender.username,
      content,
      mediaType,
    });

    return payload;
  }

  async thread(userId: string, peerId: string, take = 40) {
    const rows = await this.prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: peerId },
          { senderId: peerId, receiverId: userId },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(take, 100),
    });
    await this.prisma.message.updateMany({
      where: { senderId: peerId, receiverId: userId, readAt: null },
      data: { readAt: new Date() },
    });
    return rows.reverse().map((m) => this.mapMessage(m));
  }

  async conversations(userId: string, take = 40) {
    const capped = Math.min(Math.max(take, 1), 80);
    const rows = await this.prisma.message.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      orderBy: { createdAt: "desc" },
      take: Math.max(capped * 6, 80),
      include: {
        sender: {
          select: { id: true, username: true, avatarUrl: true },
        },
        receiver: {
          select: { id: true, username: true, avatarUrl: true },
        },
      },
    });

    const byPeer = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      const peerId = row.senderId === userId ? row.receiverId : row.senderId;
      if (!byPeer.has(peerId)) byPeer.set(peerId, row);
      if (byPeer.size >= capped) break;
    }

    return [...byPeer.values()].map((row) => {
      const peer = row.senderId === userId ? row.receiver : row.sender;
      return {
        peer: {
          id: peer.id,
          username: peer.username,
          avatarUrl: peer.avatarUrl,
        },
        lastMessage: this.mapMessage(row),
      };
    });
  }

  async setPrivateChatLocked(
    actorId: string,
    role: Role,
    viewerId: string,
    locked: boolean,
  ) {
    if (role !== Role.MODEL && role !== Role.ADMIN) {
      throw new ForbiddenException("solo_streamer");
    }
    if (actorId === viewerId) {
      throw new BadRequestException("utente_non_valido");
    }
    const viewer = await this.prisma.user.findUnique({
      where: { id: viewerId },
      select: { id: true, banned: true },
    });
    if (!viewer || viewer.banned) {
      throw new NotFoundException("utente_non_trovato");
    }
    const row = await this.prisma.privateChatControl.upsert({
      where: { creatorId_viewerId: { creatorId: actorId, viewerId } },
      create: { creatorId: actorId, viewerId, locked },
      update: { locked },
    });
    return {
      ok: true,
      creatorId: row.creatorId,
      viewerId: row.viewerId,
      locked: row.locked,
    };
  }

  async privateChatStatus(actorId: string, role: Role, viewerId: string) {
    if (role !== Role.MODEL && role !== Role.ADMIN) {
      throw new ForbiddenException("solo_streamer");
    }
    const row = await this.prisma.privateChatControl.findUnique({
      where: { creatorId_viewerId: { creatorId: actorId, viewerId } },
      select: { locked: true },
    });
    return { viewerId, locked: row?.locked === true };
  }

  private mapMessage(m: {
    id: string;
    senderId: string;
    receiverId: string;
    content: string;
    mediaUrl?: string | null;
    mediaType?: string | null;
    readAt?: Date | null;
    createdAt: Date;
  }) {
    return {
      id: m.id,
      senderId: m.senderId,
      receiverId: m.receiverId,
      content: m.content,
      mediaUrl: m.mediaUrl ?? null,
      mediaType: m.mediaType ?? null,
      readAt: m.readAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
    };
  }
}
