import { Injectable, Logger } from "@nestjs/common";
import { NotificationType, Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const ONLINE_NOTIFICATION_COOLDOWN_MS = 8 * 60 * 60 * 1000;

@Injectable()
export class NotificationsService {
  private readonly log = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string, take = 40) {
    const capped = Math.min(Math.max(take, 1), 80);
    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: capped,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          payload: true,
          readAt: true,
          createdAt: true,
          actorId: true,
        },
      }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    return {
      unreadCount,
      items: items.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        payload: n.payload,
        actorId: n.actorId,
        read: n.readAt != null,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
    };
  }

  async markOneRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { userId, id },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async notifyDirectMessage(input: {
    senderId: string;
    receiverId: string;
    senderUsername: string;
    content: string;
    mediaType: string | null;
  }) {
    if (input.senderId === input.receiverId) return;
    const preview =
      input.content.trim() ||
      (input.mediaType === "image"
        ? "Ha inviato una foto"
        : input.mediaType === "video"
          ? "Ha inviato un video"
          : "Ha inviato un file");
    try {
      await this.prisma.notification.create({
        data: {
          userId: input.receiverId,
          type: NotificationType.DIRECT_MESSAGE,
          actorId: input.senderId,
          title: `Nuovo messaggio da ${input.senderUsername}`,
          body: preview.slice(0, 180),
          payload: {
            peerId: input.senderId,
            message: true,
          },
        },
      });
    } catch (err) {
      this.log.warn(
        "notifyDirectMessage fallito",
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /** Chiamato quando una creator MODEL va live: notifica tutti i follower. */
  async notifyFollowersCreatorLive(
    actorId: string,
    streamId: string,
    streamTitle: string,
  ) {
    try {
      const actor = await this.prisma.user.findUnique({
        where: { id: actorId },
        select: { username: true, banned: true },
      });
      if (!actor || actor.banned) return;

      const followers = await this.prisma.follow.findMany({
        where: { followingId: actorId },
        select: { followerId: true },
      });

      const displayTitle = streamTitle?.trim() || "Live";

      const rows = followers.map((f) => ({
        userId: f.followerId,
        type: NotificationType.CREATOR_LIVE,
        actorId,
        title: `${actor.username} è in diretta`,
        body: displayTitle,
        payload: {
          creatorId: actorId,
          streamId,
        },
      }));

      const chunkSize = 200;
      for (let i = 0; i < rows.length; i += chunkSize) {
        await this.prisma.notification.createMany({
          data: rows.slice(i, i + chunkSize),
        });
      }
    } catch (err) {
      this.log.warn(
        "notifyFollowersCreatorLive fallito",
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /**
   * Chiamato dal ping presenza: se la creator era “assente” (oltre ONLINE_PRESENCE_MS)
   * e ora torna contattabile, una notifica CREATOR_ONLINE per follower con cooldown lungo.
   */
  async maybeNotifyFollowersCreatorOnline(
    actorId: string,
    returnedFromAbsence: boolean,
  ) {
    if (!returnedFromAbsence) return;

    try {
      const actor = await this.prisma.user.findUnique({
        where: { id: actorId },
        select: { username: true, banned: true, role: true },
      });
      if (!actor || actor.banned) return;
      if (actor.role !== Role.MODEL && actor.role !== Role.ADMIN) return;

      /** Se è già in live, CREATOR_LIVE copre già il contesto principale. */
      const live = await this.prisma.stream.findFirst({
        where: { userId: actorId, status: "LIVE" },
        select: { id: true },
      });
      if (live) return;

      const followers = await this.prisma.follow.findMany({
        where: { followingId: actorId },
        select: { followerId: true },
      });

      const since = new Date(Date.now() - ONLINE_NOTIFICATION_COOLDOWN_MS);

      for (const f of followers) {
        const recent = await this.prisma.notification.findFirst({
          where: {
            userId: f.followerId,
            actorId,
            type: NotificationType.CREATOR_ONLINE,
            createdAt: { gte: since },
          },
          select: { id: true },
        });
        if (recent) continue;

        await this.prisma.notification.create({
          data: {
            userId: f.followerId,
            type: NotificationType.CREATOR_ONLINE,
            actorId,
            title: `${actor.username} è sulla piattaforma`,
            payload: {
              creatorId: actorId,
              presenceOnly: true,
            },
          },
        });
      }
    } catch (err) {
      this.log.warn(
        "maybeNotifyFollowersCreatorOnline fallito",
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
