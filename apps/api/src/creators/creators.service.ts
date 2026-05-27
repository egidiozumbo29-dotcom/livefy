import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { OutboxService } from "../outbox/outbox.service";
import { PrismaService } from "../prisma/prisma.service";
import type { ReplaceGalleryDto } from "./dto/replace-gallery.dto";
import type { ReplaceTipMenuDto } from "./dto/replace-tip-menu.dto";

@Injectable()
export class CreatorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly outbox: OutboxService,
  ) {}

  private feePercent(): number {
    const raw = this.config.get<string>("PLATFORM_TIP_FEE_PERCENT");
    const n = raw != null ? Number(raw) : 0;
    if (!Number.isFinite(n) || n < 0 || n > 90) return 0;
    return n;
  }

  tipMenu(modelId: string) {
    return this.prisma.tipMenuItem.findMany({
      where: { modelId },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { id: true, label: true, tokenCost: true, sortOrder: true },
    });
  }

  async replaceTipMenu(modelId: string, dto: ReplaceTipMenuDto) {
    await this.prisma.$transaction(async (tx) => {
      await tx.tipMenuItem.deleteMany({ where: { modelId } });
      if (!dto.items.length) return;
      await tx.tipMenuItem.createMany({
        data: dto.items.map((item, idx) => ({
          modelId,
          label: item.label.trim(),
          tokenCost: item.tokenCost,
          sortOrder: item.sortOrder ?? idx,
        })),
      });
    });
    return this.tipMenu(modelId);
  }

  async analytics(receiverId: string) {
    const now = new Date();
    const since7d = new Date(now);
    since7d.setUTCDate(since7d.getUTCDate() - 7);
    const since30d = new Date(now);
    since30d.setUTCDate(since30d.getUTCDate() - 30);

    const sumNum = (d: Prisma.Decimal | null | undefined) =>
      d ? Number(d.toString()) : 0;

    const dayKey = (date: Date) => date.toISOString().slice(0, 10);
    const days = Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - (6 - idx));
      return dayKey(d);
    });

    const [
      creator,
      totalAgg,
      recentTips,
      tipsLast30d,
      streamAccessAgg,
      streamAccessLast7d,
      galleryAgg,
      galleryLast7d,
      topGrouped,
      topLifetimeGrouped,
      followers,
      followersLast7d,
      profileVisits,
      profileVisitsLast7d,
      liveStream,
      recentStreams,
      streamCount,
    ] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: receiverId },
        select: { creatorBalance: true },
      }),
      this.prisma.tip.aggregate({
        where: { receiverId },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.tip.aggregate({
        where: { receiverId, createdAt: { gte: since7d } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.tip.findMany({
        where: { receiverId, createdAt: { gte: since30d } },
        select: { amount: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.streamAccess.aggregate({
        where: { stream: { userId: receiverId } },
        _sum: { pricePaid: true },
        _count: { _all: true },
      }),
      this.prisma.streamAccess.aggregate({
        where: { stream: { userId: receiverId }, startedAt: { gte: since7d } },
        _sum: { pricePaid: true },
        _count: { _all: true },
      }),
      this.prisma.galleryPurchase.aggregate({
        where: { item: { creatorId: receiverId } },
        _sum: { pricePaid: true },
        _count: { _all: true },
      }),
      this.prisma.galleryPurchase.aggregate({
        where: { item: { creatorId: receiverId }, createdAt: { gte: since7d } },
        _sum: { pricePaid: true },
        _count: { _all: true },
      }),
      this.prisma.tip.groupBy({
        by: ["senderId"],
        where: { receiverId, createdAt: { gte: since7d } },
        _sum: { amount: true },
      }),
      this.prisma.tip.groupBy({
        by: ["senderId"],
        where: { receiverId },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.follow.count({
        where: { followingId: receiverId },
      }),
      this.prisma.follow.count({
        where: { followingId: receiverId, createdAt: { gte: since7d } },
      }),
      this.prisma.profileVisit.count({
        where: { creatorId: receiverId },
      }),
      this.prisma.profileVisit.count({
        where: { creatorId: receiverId, lastViewedAt: { gte: since7d } },
      }),
      this.prisma.stream.findFirst({
        where: { userId: receiverId, status: "LIVE" },
        select: {
          id: true,
          title: true,
          viewers: true,
          startedAt: true,
          showMode: true,
          chatOpen: true,
        },
      }),
      this.prisma.stream.findMany({
        where: { userId: receiverId },
        orderBy: { startedAt: "desc" },
        take: 8,
        select: {
          id: true,
          title: true,
          status: true,
          viewers: true,
          startedAt: true,
          endedAt: true,
          showMode: true,
          _count: { select: { tips: true, accesses: true } },
        },
      }),
      this.prisma.stream.count({ where: { userId: receiverId } }),
    ]);

    /** Ordinamento in memoria: orderBy su _sum in groupBy è fragile tra versioni DB/Prisma. */
    const topRaw = topGrouped
      .map((row) => ({
        senderId: row.senderId,
        _sum: row._sum,
      }))
      .sort((a, b) => sumNum(b._sum.amount) - sumNum(a._sum.amount))
      .slice(0, 10);

    const topLifetimeRaw = topLifetimeGrouped
      .map((row) => ({
        senderId: row.senderId,
        _sum: row._sum,
        _count: row._count,
      }))
      .sort((a, b) => sumNum(b._sum.amount) - sumNum(a._sum.amount))
      .slice(0, 10);

    const senderIds = Array.from(
      new Set([
        ...topRaw.map((t) => t.senderId),
        ...topLifetimeRaw.map((t) => t.senderId),
      ]),
    );
    const senders =
      senderIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: senderIds } },
            select: { id: true, username: true, avatarUrl: true },
          })
        : [];
    const senderMap = new Map(senders.map((s) => [s.id, s]));

    const recentStreamIds = recentStreams.map((s) => s.id);
    type TipStreamSum = {
      streamId: string | null;
      _sum: { amount: Prisma.Decimal | null };
    };
    type AccessStreamSum = {
      streamId: string;
      _sum: { pricePaid: number | null };
    };
    const [recentStreamTipSums, recentStreamAccessSums] = await Promise.all([
      recentStreamIds.length
        ? this.prisma.tip.groupBy({
            by: ["streamId"],
            where: { streamId: { in: recentStreamIds } },
            _sum: { amount: true },
          })
        : ([] as TipStreamSum[]),
      recentStreamIds.length
        ? this.prisma.streamAccess.groupBy({
            by: ["streamId"],
            where: { streamId: { in: recentStreamIds } },
            _sum: { pricePaid: true },
          })
        : ([] as AccessStreamSum[]),
    ]);
    const tipsByStream = new Map(
      recentStreamTipSums
        .filter((row) => row.streamId)
        .map((row) => [row.streamId!, sumNum(row._sum.amount)]),
    );
    const accessByStream = new Map(
      recentStreamAccessSums.map((row) => [
        row.streamId,
        row._sum.pricePaid ?? 0,
      ]),
    );

    const peakStream = recentStreams.reduce<{
      viewers: number;
      title: string | null;
      startedAt: Date | null;
    } | null>((best, stream) => {
      if (!best || stream.viewers > best.viewers) {
        return {
          viewers: stream.viewers,
          title: stream.title,
          startedAt: stream.startedAt,
        };
      }
      return best;
    }, null);

    const dailyMap = new Map(
      days.map((day) => [
        day,
        {
          date: day,
          tipTokens: 0,
          tipCount: 0,
        },
      ]),
    );
    for (const tip of tipsLast30d) {
      const key = dayKey(tip.createdAt);
      const row = dailyMap.get(key);
      if (!row) continue;
      row.tipTokens += sumNum(tip.amount);
      row.tipCount += 1;
    }

    const streamDurations = recentStreams
      .filter((stream) => stream.startedAt)
      .map((stream) => {
        const end = stream.endedAt ?? now;
        return Math.max(0, end.getTime() - stream.startedAt!.getTime());
      });
    const totalLiveMs = streamDurations.reduce((sum, ms) => sum + ms, 0);
    const avgLiveMinutes =
      streamDurations.length > 0
        ? Math.round(totalLiveMs / streamDurations.length / 60000)
        : 0;

    const streamStats = recentStreams.map((stream) => ({
      id: stream.id,
      title: stream.title || "Live senza titolo",
      status: stream.status,
      showMode: stream.showMode,
      viewers: stream.viewers,
      startedAt: stream.startedAt?.toISOString() ?? null,
      endedAt: stream.endedAt?.toISOString() ?? null,
      durationMinutes: stream.startedAt
        ? Math.max(
            0,
            Math.round(((stream.endedAt ?? now).getTime() - stream.startedAt.getTime()) / 60000),
          )
        : 0,
      tipCount: stream._count.tips,
      accessCount: stream._count.accesses,
      tipTokens: tipsByStream.get(stream.id) ?? 0,
      accessTokens: accessByStream.get(stream.id) ?? 0,
    }));

    const grossTipTokens = sumNum(totalAgg._sum.amount);
    const grossTipTokens7d = sumNum(recentTips._sum.amount);
    const accessTokens = streamAccessAgg._sum.pricePaid ?? 0;
    const accessTokens7d = streamAccessLast7d._sum.pricePaid ?? 0;
    const galleryTokens = galleryAgg._sum.pricePaid ?? 0;
    const galleryTokens7d = galleryLast7d._sum.pricePaid ?? 0;

    const feePct = this.feePercent();
    const grossLifetimeTokens = grossTipTokens + accessTokens + galleryTokens;
    const grossLast7dTokens = grossTipTokens7d + accessTokens7d + galleryTokens7d;
    const estimatedNetLifetimeTokens = Math.round(
      grossLifetimeTokens * ((100 - feePct) / 100),
    );
    const estimatedNetLast7dTokens = Math.round(
      grossLast7dTokens * ((100 - feePct) / 100),
    );

    const currentPrivateViewer =
      liveStream?.id != null
        ? await this.prisma.stream.findUnique({
            where: { id: liveStream.id },
            select: {
              currentPrivateViewerId: true,
            },
          })
        : null;

    const activeAccesses =
      liveStream?.id != null
        ? await this.prisma.streamAccess.count({
            where: { streamId: liveStream.id, endedAt: null },
          })
        : 0;

    return {
      earnings: {
        creatorBalance: sumNum(creator?.creatorBalance),
        grossLifetimeTokens,
        grossLast7dTokens,
        estimatedNetLifetimeTokens,
        estimatedNetLast7dTokens,
        feePercent: feePct,
        sources: {
          tips: {
            lifetimeTokens: grossTipTokens,
            last7dTokens: grossTipTokens7d,
            lifetimeCount: totalAgg._count._all,
            last7dCount: recentTips._count._all,
          },
          paidAccess: {
            lifetimeTokens: accessTokens,
            last7dTokens: accessTokens7d,
            lifetimeCount: streamAccessAgg._count._all,
            last7dCount: streamAccessLast7d._count._all,
          },
          gallery: {
            lifetimeTokens: galleryTokens,
            last7dTokens: galleryTokens7d,
            lifetimeCount: galleryAgg._count._all,
            last7dCount: galleryLast7d._count._all,
          },
        },
      },
      audience: {
        followers,
        followersLast7d,
        profileVisits,
        profileVisitsLast7d,
      },
      realtime: {
        isLive: !!liveStream,
        streamId: liveStream?.id ?? null,
        title: liveStream?.title ?? null,
        viewers: liveStream?.viewers ?? 0,
        showMode: liveStream?.showMode ?? null,
        chatOpen: liveStream?.chatOpen ?? null,
        startedAt: liveStream?.startedAt?.toISOString() ?? null,
        activeAccesses,
        inPrivateShow: !!currentPrivateViewer?.currentPrivateViewerId,
      },
      livestreams: {
        totalCount: streamCount,
        recentCount: recentStreams.length,
        totalLiveMinutes: Math.round(totalLiveMs / 60000),
        avgLiveMinutes,
        peakViewers: peakStream?.viewers ?? 0,
        peakStreamTitle: peakStream?.title ?? null,
        recent: streamStats,
      },
      daily: Array.from(dailyMap.values()),
      followers,
      tipsLifetimeCount: totalAgg._count._all,
      tipsLifetimeTokens: grossTipTokens,
      tipsLast7dCount: recentTips._count._all,
      tipsLast7dTokens: grossTipTokens7d,
      topTippersLast7d: topRaw.map((row) => ({
        sender: senderMap.get(row.senderId),
        tokens: sumNum(row._sum.amount),
      })),
      topSupporters: topLifetimeRaw.map((row, idx) => ({
        rank: idx + 1,
        sender: senderMap.get(row.senderId),
        tokens: sumNum(row._sum.amount),
        tipCount: row._count._all,
      })),
      peakViewers: peakStream?.viewers ?? 0,
      peakStreamTitle: peakStream?.title ?? null,
    };
  }

  async myGallery(modelId: string) {
    const rows = await this.prisma.galleryItem.findMany({
      where: { creatorId: modelId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        kind: true,
        title: true,
        mediaUrl: true,
        thumbnailUrl: true,
        tokenPrice: true,
        published: true,
        sortOrder: true,
        createdAt: true,
      },
    });
    return rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async replaceGallery(modelId: string, dto: ReplaceGalleryDto) {
    await this.prisma.$transaction(async (tx) => {
      await tx.galleryItem.deleteMany({ where: { creatorId: modelId } });
      if (!dto.items.length) return;
      await tx.galleryItem.createMany({
        data: dto.items.map((item, idx) => ({
          creatorId: modelId,
          kind: item.kind,
          title: (item.title ?? "").trim().slice(0, 200),
          mediaUrl: item.mediaUrl.trim().slice(0, 2048),
          thumbnailUrl: item.thumbnailUrl?.trim()
            ? item.thumbnailUrl.trim().slice(0, 2048)
            : null,
          tokenPrice: Math.max(0, Math.floor(item.tokenPrice)),
          published: item.published !== false,
          sortOrder: item.sortOrder ?? idx,
        })),
      });
    });
    return this.myGallery(modelId);
  }

  async publicGallery(creatorId: string, viewerId: string | null) {
    const creator = await this.prisma.user.findUnique({
      where: { id: creatorId },
      select: { id: true },
    });
    if (!creator) throw new NotFoundException();

    const isOwner = viewerId === creatorId;
    const rows = await this.prisma.galleryItem.findMany({
      where: {
        creatorId,
        ...(isOwner ? {} : { published: true }),
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    let purchasedIds = new Set<string>();
    if (viewerId && !isOwner && rows.length > 0) {
      const purchases = await this.prisma.galleryPurchase.findMany({
        where: {
          buyerId: viewerId,
          itemId: { in: rows.map((r) => r.id) },
        },
        select: { itemId: true },
      });
      purchasedIds = new Set(purchases.map((p) => p.itemId));
    }

    return {
      items: rows.map((row) => {
        const free = row.tokenPrice <= 0;
        const unlocked = isOwner || free || purchasedIds.has(row.id);
        return {
          id: row.id,
          kind: row.kind,
          title: row.title,
          tokenPrice: row.tokenPrice,
          thumbnailUrl: row.thumbnailUrl,
          mediaUrl: unlocked ? row.mediaUrl : null,
          unlocked,
        };
      }),
    };
  }

  async purchaseGalleryItem(buyerId: string, itemId: string) {
    const feePct = this.feePercent();
    const netMul = new Prisma.Decimal(100 - feePct).div(100);

    const result = await this.prisma.$transaction(async (tx) => {
      const item = await tx.galleryItem.findUnique({
        where: { id: itemId },
        select: {
          id: true,
          creatorId: true,
          tokenPrice: true,
          published: true,
        },
      });
      if (!item || !item.published) throw new NotFoundException();
      if (item.creatorId === buyerId) {
        throw new BadRequestException("acquisto_proprio_contenuto");
      }
      if (item.tokenPrice <= 0) {
        throw new BadRequestException("contenuto_gratuito");
      }

      const existing = await tx.galleryPurchase.findUnique({
        where: {
          itemId_buyerId: { itemId: item.id, buyerId },
        },
      });
      if (existing) {
        return { already: true as const, itemId: item.id };
      }

      const priceDec = new Prisma.Decimal(item.tokenPrice);
      const buyer = await tx.user.findUnique({
        where: { id: buyerId },
        select: { id: true, balance: true, banned: true },
      });
      if (!buyer || buyer.banned) throw new NotFoundException();
      if (buyer.balance.lt(priceDec)) {
        throw new BadRequestException("saldo_insufficiente");
      }

      const net = priceDec.mul(netMul);

      await tx.user.update({
        where: { id: buyerId },
        data: { balance: { decrement: priceDec } },
      });
      await tx.user.update({
        where: { id: item.creatorId },
        data: { creatorBalance: { increment: net } },
      });
      const purchase = await tx.galleryPurchase.create({
        data: {
          itemId: item.id,
          buyerId,
          pricePaid: item.tokenPrice,
        },
      });
      const creator = await tx.user.findUnique({
        where: { id: item.creatorId },
        select: { username: true },
      });
      await this.outbox.write(tx, {
        type: "GALLERY_PURCHASE",
        externalId: `gallery_${purchase.id}`,
        occurredAt: purchase.createdAt,
        userId: item.creatorId,
        username: creator?.username ?? null,
        amountTokens: item.tokenPrice,
        amountEur: this.outbox.tokensToEur(item.tokenPrice),
        meta: { itemId: item.id, buyerId },
      });
      return { already: false as const, itemId: item.id };
    });

    if (result.already) {
      return { ok: true, alreadyOwned: true };
    }
    return { ok: true, alreadyOwned: false };
  }
}
