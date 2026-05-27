import { Injectable } from "@nestjs/common";
import { Prisma, Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { StreamsService } from "../streams/streams.service";
import {
  isUserOnlinePresence,
  ONLINE_PRESENCE_MS,
} from "../users/profile-social.helpers";

export type DiscoverySearchFilters = {
  q?: string;
  category?: string;
  gender?: string;
  country?: string;
  language?: string;
  tag?: string;
  coupleOnly?: boolean;
  sort?: "new" | "followers" | "relevance";
  take?: number;
};

const MODEL_ROLES = { in: [Role.MODEL, Role.ADMIN] as Role[] };

/** Stesse card della lista pubblica `/streams/live` (snippet creator incluso). */
export type TrendingLiveRow = Awaited<
  ReturnType<StreamsService["listLive"]>
>[number];

@Injectable()
export class DiscoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly streams: StreamsService,
  ) {}

  async categoriesList() {
    const rows = await this.prisma.user.groupBy({
      by: ["category"],
      where: {
        banned: false,
        role: MODEL_ROLES,
        category: { not: null },
        NOT: { category: "" },
      },
      _count: { _all: true },
    });

    const items = rows
      .map((r) => ({
        name: (r.category ?? "").trim(),
        count: r._count._all,
      }))
      .filter((r) => r.name.length > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    return { items };
  }

  async creatorsOnline(takeRaw = 24) {
    const take = Math.min(Math.max(takeRaw, 1), 48);
    const threshold = new Date(Date.now() - ONLINE_PRESENCE_MS);

    const rows = await this.prisma.user.findMany({
      where: {
        banned: false,
        role: MODEL_ROLES,
        OR: [
          { lastSeenAt: { gte: threshold } },
          { streams: { some: { status: "LIVE" } } },
        ],
      },
      take,
      orderBy: { username: "asc" },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        category: true,
        tags: true,
        gender: true,
        country: true,
        language: true,
        isCouple: true,
        lastSeenAt: true,
        streams: {
          where: { status: "LIVE" },
          take: 1,
          select: {
            id: true,
            title: true,
            viewers: true,
            isPrivate: true,
            passwordHash: true,
          },
        },
      },
    });

    return {
      items: rows.map((u) => {
        const live = u.streams[0];
        const isLive = !!live;
        const discoverableLive =
          isLive &&
          live &&
          !live.isPrivate &&
          live.passwordHash == null;

        return {
          id: u.id,
          username: u.username,
          avatarUrl: u.avatarUrl,
          category: u.category,
          tags: u.tags,
          gender: u.gender,
          country: u.country,
          language: u.language,
          isCouple: u.isCouple,
          isLive,
          viewers: live?.viewers ?? 0,
          liveTitle: live?.title ?? null,
          canOpenDiscoverLive: discoverableLive,
          isOnline: isUserOnlinePresence(isLive, u.lastSeenAt ?? null),
        };
      }),
    };
  }

  async trendingLive(takeRaw = 30): Promise<{ items: TrendingLiveRow[] }> {
    const take = Math.min(Math.max(takeRaw, 1), 60);
    const liveRows = await this.streams.listLive();
    const creatorIds = liveRows.map((r) => r.id).filter(Boolean);
    if (!creatorIds.length) {
      return { items: [] };
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const tips = await this.prisma.tip.groupBy({
      by: ["receiverId"],
      where: {
        receiverId: { in: creatorIds },
        createdAt: { gte: since },
      },
      _sum: { amount: true },
    });
    const tipMap = new Map(
      tips.map((t) => [
        t.receiverId,
        Number(t._sum.amount?.toString() ?? "0"),
      ]),
    );

    const items = [...liveRows]
      .map((row) => ({
        row,
        score: row.viewers * 80 + (tipMap.get(row.id) ?? 0),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, take)
      .map((x) => x.row);

    return { items };
  }

  async recommendedModels(takeRaw = 18) {
    const take = Math.min(Math.max(takeRaw, 1), 36);
    const rows = await this.prisma.user.findMany({
      where: { banned: false, role: MODEL_ROLES },
      orderBy: { followerRelations: { _count: "desc" } },
      take,
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        category: true,
        tags: true,
        gender: true,
        country: true,
        language: true,
        isCouple: true,
        createdAt: true,
        _count: { select: { followerRelations: true } },
      },
    });

    const ids = rows.map((r) => r.id);
    const lives =
      ids.length === 0
        ? []
        : await this.prisma.stream.findMany({
            where: { userId: { in: ids }, status: "LIVE" },
            select: {
              userId: true,
              viewers: true,
              title: true,
              isPrivate: true,
              passwordHash: true,
            },
          });
    const liveByUser = new Map(lives.map((s) => [s.userId, s]));

    return {
      items: rows.map((u) => {
        const live = liveByUser.get(u.id);
        const isLive = !!live;
        const discoverableLive =
          isLive &&
          live &&
          !live.isPrivate &&
          live.passwordHash == null;

        return {
          id: u.id,
          username: u.username,
          avatarUrl: u.avatarUrl,
          category: u.category,
          tags: u.tags,
          gender: u.gender,
          country: u.country,
          language: u.language,
          isCouple: u.isCouple,
          followerCount: u._count.followerRelations,
          createdAt: u.createdAt.toISOString(),
          isLive,
          viewers: live?.viewers ?? 0,
          liveTitle: live?.title ?? null,
          canOpenDiscoverLive: discoverableLive,
        };
      }),
    };
  }

  async newModels(takeRaw = 18) {
    const take = Math.min(Math.max(takeRaw, 1), 36);
    const rows = await this.prisma.user.findMany({
      where: { banned: false, role: MODEL_ROLES },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        category: true,
        tags: true,
        gender: true,
        country: true,
        language: true,
        isCouple: true,
        createdAt: true,
      },
    });

    const ids = rows.map((r) => r.id);
    const lives =
      ids.length === 0
        ? []
        : await this.prisma.stream.findMany({
            where: { userId: { in: ids }, status: "LIVE" },
            select: {
              userId: true,
              viewers: true,
              title: true,
              isPrivate: true,
              passwordHash: true,
            },
          });
    const liveByUser = new Map(lives.map((s) => [s.userId, s]));

    return {
      items: rows.map((u) => {
        const live = liveByUser.get(u.id);
        const isLive = !!live;
        const discoverableLive =
          isLive &&
          live &&
          !live.isPrivate &&
          live.passwordHash == null;

        return {
          id: u.id,
          username: u.username,
          avatarUrl: u.avatarUrl,
          category: u.category,
          tags: u.tags,
          gender: u.gender,
          country: u.country,
          language: u.language,
          isCouple: u.isCouple,
          joinedAt: u.createdAt.toISOString(),
          isLive,
          viewers: live?.viewers ?? 0,
          liveTitle: live?.title ?? null,
          canOpenDiscoverLive: discoverableLive,
        };
      }),
    };
  }

  async topEarners(takeRaw = 15, windowDaysRaw = 30) {
    const take = Math.min(Math.max(takeRaw, 1), 40);
    const windowDays = Math.min(Math.max(windowDaysRaw, 7), 365);
    const since = new Date(Date.now() - windowDays * 86400000);

    const sumsRaw = await this.prisma.tip.groupBy({
      by: ["receiverId"],
      where: { createdAt: { gte: since } },
      _sum: { amount: true },
    });

    const sums = [...sumsRaw]
      .map((row) => ({
        ...row,
        _sumAmt: Number(row._sum.amount?.toString() ?? "0"),
      }))
      .filter((row) => row._sumAmt > 0 && row.receiverId)
      .sort((a, b) => b._sumAmt - a._sumAmt)
      .slice(0, Math.max(take * 3, 30));

    const receiverIds = sums.map((s) => s.receiverId);
    if (!receiverIds.length) {
      return { items: [], windowDays };
    }

    const users = await this.prisma.user.findMany({
      where: {
        id: { in: receiverIds },
        banned: false,
        role: MODEL_ROLES,
      },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        category: true,
        tags: true,
      },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const lives = await this.prisma.stream.findMany({
      where: {
        userId: { in: users.map((u) => u.id) },
        status: "LIVE",
      },
      select: {
        userId: true,
        viewers: true,
        isPrivate: true,
        passwordHash: true,
      },
    });
    const liveByUser = new Map(lives.map((s) => [s.userId, s]));

    const items: {
      id: string;
      username: string;
      avatarUrl: string | null;
      category: string | null;
      tags: string[];
      tipTokens: number;
      isLive: boolean;
      viewers: number;
      canOpenDiscoverLive: boolean;
    }[] = [];

    for (const row of sums) {
      const u = userMap.get(row.receiverId);
      if (!u) continue;
      const tipTokens = Math.round(row._sumAmt);
      if (tipTokens <= 0) continue;
      const live = liveByUser.get(u.id);
      const isLive = !!live;
      const discoverableLive =
        isLive &&
        live &&
        !live.isPrivate &&
        live.passwordHash == null;
      items.push({
        id: u.id,
        username: u.username,
        avatarUrl: u.avatarUrl,
        category: u.category,
        tags: u.tags,
        tipTokens,
        isLive,
        viewers: live?.viewers ?? 0,
        canOpenDiscoverLive: discoverableLive,
      });
      if (items.length >= take) break;
    }

    return { items, windowDays };
  }

  async searchAdvanced(filters: DiscoverySearchFilters) {
    const take = Math.min(Math.max(filters.take ?? 24, 1), 60);
    const q = filters.q?.trim() ?? "";
    const sort = filters.sort ?? "relevance";

    const andParts: Prisma.UserWhereInput[] = [
      { banned: false, role: MODEL_ROLES },
    ];

    if (filters.category?.trim()) {
      andParts.push({
        category: {
          equals: filters.category.trim(),
          mode: "insensitive",
        },
      });
    }
    if (filters.gender?.trim()) {
      andParts.push({
        gender: { equals: filters.gender.trim(), mode: "insensitive" },
      });
    }
    if (filters.country?.trim()) {
      andParts.push({
        country: { contains: filters.country.trim(), mode: "insensitive" },
      });
    }
    if (filters.language?.trim()) {
      const lang = filters.language.trim();
      andParts.push({
        OR: [
          { language: { equals: lang, mode: "insensitive" } },
          { languages: { has: lang } },
        ],
      });
    }
    if (filters.coupleOnly === true) {
      andParts.push({ isCouple: true });
    }
    if (filters.tag?.trim()) {
      andParts.push({
        tags: { hasSome: [filters.tag.trim().toLowerCase()] },
      });
    }
    if (q.length >= 2) {
      andParts.push({
        OR: [
          { username: { contains: q, mode: "insensitive" } },
          { tags: { hasSome: [q.toLowerCase()] } },
          { bio: { contains: q, mode: "insensitive" } },
        ],
      });
    }

    let orderBy: Prisma.UserOrderByWithRelationInput[] =
      sort === "new"
        ? [{ createdAt: "desc" }]
        : sort === "followers"
          ? [{ followerRelations: { _count: "desc" } }]
          : [{ username: "asc" }];

    if (sort === "relevance" && q.length >= 2) {
      orderBy = [{ username: "asc" }];
    }

    const rows = await this.prisma.user.findMany({
      where: { AND: andParts },
      orderBy,
      take,
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        category: true,
        tags: true,
        gender: true,
        country: true,
        language: true,
        languages: true,
        isCouple: true,
        createdAt: true,
        _count: { select: { followerRelations: true } },
      },
    });

    const ids = rows.map((r) => r.id);
    const lives =
      ids.length === 0
        ? []
        : await this.prisma.stream.findMany({
            where: { userId: { in: ids }, status: "LIVE" },
            select: {
              userId: true,
              viewers: true,
              title: true,
              isPrivate: true,
              passwordHash: true,
            },
          });
    const liveByUser = new Map(lives.map((s) => [s.userId, s]));

    return {
      items: rows.map((u) => {
        const live = liveByUser.get(u.id);
        const isLive = !!live;
        const discoverableLive =
          isLive &&
          live &&
          !live.isPrivate &&
          live.passwordHash == null;
        return {
          id: u.id,
          username: u.username,
          avatarUrl: u.avatarUrl,
          category: u.category,
          tags: u.tags,
          gender: u.gender,
          country: u.country,
          language: u.language,
          languages: u.languages,
          isCouple: u.isCouple,
          createdAt: u.createdAt.toISOString(),
          followerCount: u._count.followerRelations,
          isLive,
          viewers: live?.viewers ?? 0,
          liveTitle: live?.title ?? null,
          canOpenDiscoverLive: discoverableLive,
        };
      }),
    };
  }
}
