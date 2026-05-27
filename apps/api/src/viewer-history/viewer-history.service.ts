import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ViewerHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async recordVisit(viewerId: string, creatorId: string) {
    if (viewerId === creatorId) {
      throw new BadRequestException("no_self_visit");
    }
    const target = await this.prisma.user.findUnique({
      where: { id: creatorId },
      select: { id: true, banned: true },
    });
    if (!target || target.banned) throw new NotFoundException();

    await this.prisma.profileVisit.upsert({
      where: {
        viewerId_creatorId: { viewerId, creatorId },
      },
      update: { lastViewedAt: new Date() },
      create: { viewerId, creatorId },
    });
    return { ok: true };
  }

  async listForViewer(viewerId: string, take = 50) {
    const capped = Math.min(Math.max(take, 1), 100);
    const rows = await this.prisma.profileVisit.findMany({
      where: { viewerId },
      orderBy: { lastViewedAt: "desc" },
      take: capped,
      select: {
        lastViewedAt: true,
        creator: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            category: true,
            lastSeenAt: true,
            banned: true,
          },
        },
      },
    });

    const creators = rows
      .filter((r) => !r.creator.banned)
      .map((r) => r.creator);
    const creatorIds = creators.map((c) => c.id);

    const lives =
      creatorIds.length === 0
        ? []
        : await this.prisma.stream.findMany({
            where: {
              userId: { in: creatorIds },
              status: "LIVE",
            },
            select: {
              id: true,
              userId: true,
              title: true,
              viewers: true,
            },
          });

    const liveByUser = new Map(lives.map((s) => [s.userId, s]));

    return {
      items: rows
        .filter((r) => !r.creator.banned)
        .map((r) => {
          const live = liveByUser.get(r.creator.id);
          return {
            creatorId: r.creator.id,
            username: r.creator.username,
            avatarUrl: r.creator.avatarUrl,
            category: r.creator.category,
            lastViewedAt: r.lastViewedAt.toISOString(),
            isLive: !!live,
            streamId: live?.id ?? null,
            streamTitle: live?.title ?? null,
            viewers: live?.viewers ?? 0,
          };
        }),
    };
  }
}
