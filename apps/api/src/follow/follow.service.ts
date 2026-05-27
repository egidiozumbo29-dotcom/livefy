import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { isUserOnlinePresence } from "../users/profile-social.helpers";

@Injectable()
export class FollowService {
  constructor(private readonly prisma: PrismaService) {}

  async follow(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new BadRequestException("non_puoi_seguito_te_stesso");
    }
    const target = await this.prisma.user.findUnique({
      where: { id: followingId },
    });
    if (!target || target.banned) throw new NotFoundException();

    await this.prisma.follow.upsert({
      where: {
        followerId_followingId: { followerId, followingId },
      },
      create: { followerId, followingId },
      update: {},
    });
    return { ok: true };
  }

  async unfollow(followerId: string, followingId: string) {
    await this.prisma.follow.deleteMany({
      where: { followerId, followingId },
    });
    return { ok: true };
  }

  async counts(userId: string) {
    const [followers, following] = await Promise.all([
      this.prisma.follow.count({ where: { followingId: userId } }),
      this.prisma.follow.count({ where: { followerId: userId } }),
    ]);
    return { followers, following };
  }

  /** Preferiti / creator seguite, con stato live sintetizzato per la lista client. */
  async listFollowing(followerId: string) {
    const rows = await this.prisma.follow.findMany({
      where: { followerId },
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        following: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            category: true,
            role: true,
            lastSeenAt: true,
            banned: true,
          },
        },
      },
    });

    const active = rows.filter((r) => !r.following.banned);
    const ids = active.map((r) => r.following.id);
    const lives =
      ids.length === 0
        ? []
        : await this.prisma.stream.findMany({
            where: { userId: { in: ids }, status: "LIVE" },
            select: {
              id: true,
              userId: true,
              title: true,
              viewers: true,
            },
          });
    const liveByUser = new Map(lives.map((s) => [s.userId, s]));

    return {
      items: active.map((r) => {
        const f = r.following;
        const live = liveByUser.get(f.id);
        const isLive = !!live;
        return {
          creatorId: f.id,
          username: f.username,
          avatarUrl: f.avatarUrl,
          category: f.category,
          role: f.role,
          followedAt: r.createdAt.toISOString(),
          isLive,
          streamId: live?.id ?? null,
          streamTitle: live?.title ?? null,
          viewers: live?.viewers ?? 0,
          isOnline: isUserOnlinePresence(isLive, f.lastSeenAt ?? null),
        };
      }),
    };
  }

  async isFollowing(followerId: string, followingId: string) {
    const row = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: { followerId, followingId },
      },
    });
    return { following: !!row };
  }
}
