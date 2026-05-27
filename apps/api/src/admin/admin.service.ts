import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PayoutStatus, Prisma, Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { PatchUserAdminDto } from "./dto/patch-user-admin.dto";

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private feePercent(): number {
    const raw = this.config.get<string>("PLATFORM_TIP_FEE_PERCENT");
    const n = raw != null ? Number(raw) : 0;
    if (!Number.isFinite(n) || n < 0 || n > 90) return 0;
    return n;
  }

  private taxPercent(): number {
    const raw = this.config.get<string>("PLATFORM_TAX_PERCENT");
    const n = raw != null ? Number(raw) : 22;
    if (!Number.isFinite(n) || n < 0 || n > 99) return 22;
    return n;
  }

  private tokenEuroRate(): number {
    const raw = this.config.get<string>("TOKEN_EUR_RATE");
    const n = raw != null ? Number(raw) : 0.05;
    if (!Number.isFinite(n) || n < 0) return 0.05;
    return n;
  }

  private payoutWithholdPercent(): number {
    const raw = this.config.get<string>("MODEL_PAYOUT_WITHHOLD_PERCENT");
    const n = raw != null ? Number(raw) : 40;
    if (!Number.isFinite(n) || n < 0 || n > 99) return 40;
    return n;
  }

  async assertOwnerAdmin(userId: string) {
    const allowlist = (this.config.get<string>("OWNER_ADMIN_EMAILS") ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, role: true },
    });
    if (!user || user.role !== Role.ADMIN) {
      throw new ForbiddenException("owner_admin_required");
    }
    if (allowlist.length === 0) return;
    if (!allowlist.includes(user.email.toLowerCase())) {
      throw new ForbiddenException("owner_admin_required");
    }
  }

  async listUsers(take = 30, cursor?: string) {
    const t = Math.min(Math.max(take, 1), 100);
    const rows = await this.prisma.user.findMany({
      take: t + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        banned: true,
        balance: true,
        createdAt: true,
      },
    });

    const hasMore = rows.length > t;
    const items = rows.slice(0, t);
    const nextCursor =
      hasMore && items.length ? items[items.length - 1]!.id : null;

    return {
      items: items.map((u) => ({
        ...u,
        balance: Number(u.balance.toString()),
        createdAt: u.createdAt.toISOString(),
      })),
      nextCursor,
    };
  }

  async patchUser(userId: string, dto: PatchUserAdminDto) {
    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(dto.banned !== undefined ? { banned: dto.banned } : {}),
          ...(dto.role !== undefined ? { role: dto.role } : {}),
        },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          banned: true,
        },
      });
    } catch {
      throw new NotFoundException();
    }
  }

  async financeSummary(from?: string, to?: string) {
    const feePercent = this.feePercent();
    const taxPercent = this.taxPercent();
    const tokenEuroRate = this.tokenEuroRate();
    const payoutWithholdPercent = this.payoutWithholdPercent();
    const netMultiplier = (100 - feePercent) / 100;
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    const dateWhere =
      (fromDate && Number.isFinite(fromDate.getTime())) ||
      (toDate && Number.isFinite(toDate.getTime()))
        ? {
            ...(fromDate && Number.isFinite(fromDate.getTime())
              ? { gte: fromDate }
              : {}),
            ...(toDate && Number.isFinite(toDate.getTime())
              ? { lte: toDate }
              : {}),
          }
        : undefined;
    const toNumber = (value: Prisma.Decimal | number | null | undefined) =>
      value instanceof Prisma.Decimal
        ? Number(value.toString())
        : typeof value === "number"
          ? value
          : 0;

    const [models, tipGroups, streams, payoutGroups] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: { in: [Role.MODEL, Role.ADMIN] } },
        orderBy: { username: "asc" },
        select: {
          id: true,
          username: true,
          email: true,
          creatorBalance: true,
          createdAt: true,
        },
      }),
      this.prisma.tip.groupBy({
        by: ["receiverId"],
        where: dateWhere ? { createdAt: dateWhere } : undefined,
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.stream.findMany({
        where: dateWhere ? { startedAt: dateWhere } : undefined,
        select: {
          id: true,
          userId: true,
          accesses: { select: { pricePaid: true } },
        },
      }),
      this.prisma.payoutRequest.groupBy({
        by: ["userId", "status"],
        where: dateWhere ? { createdAt: dateWhere } : undefined,
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);

    const galleryPurchases = await this.prisma.galleryPurchase.findMany({
      where: dateWhere ? { createdAt: dateWhere } : undefined,
      select: {
        pricePaid: true,
        item: { select: { creatorId: true } },
      },
    });

    const tipsByCreator = new Map<
      string,
      { amount: number; count: number }
    >();
    for (const row of tipGroups) {
      tipsByCreator.set(row.receiverId, {
        amount: toNumber(row._sum.amount),
        count: row._count._all,
      });
    }

    const accessByCreator = new Map<
      string,
      { amount: number; count: number }
    >();
    for (const stream of streams) {
      const prev = accessByCreator.get(stream.userId) ?? { amount: 0, count: 0 };
      for (const access of stream.accesses) {
        prev.amount += access.pricePaid;
        prev.count += 1;
      }
      accessByCreator.set(stream.userId, prev);
    }

    const galleryByCreator = new Map<
      string,
      { amount: number; count: number }
    >();
    for (const purchase of galleryPurchases) {
      const creatorId = purchase.item.creatorId;
      const prev = galleryByCreator.get(creatorId) ?? { amount: 0, count: 0 };
      prev.amount += purchase.pricePaid;
      prev.count += 1;
      galleryByCreator.set(creatorId, prev);
    }

    const payoutsByCreator = new Map<
      string,
      { pending: number; approved: number; paid: number; rejected: number; count: number }
    >();
    for (const row of payoutGroups) {
      const prev =
        payoutsByCreator.get(row.userId) ?? {
          pending: 0,
          approved: 0,
          paid: 0,
          rejected: 0,
          count: 0,
        };
      const amount = toNumber(row._sum.amount);
      if (row.status === PayoutStatus.PENDING) prev.pending += amount;
      if (row.status === PayoutStatus.APPROVED) prev.approved += amount;
      if (row.status === PayoutStatus.PAID) prev.paid += amount;
      if (row.status === PayoutStatus.REJECTED) prev.rejected += amount;
      prev.count += row._count._all;
      payoutsByCreator.set(row.userId, prev);
    }

    const rows = models.map((model) => {
      const tips = tipsByCreator.get(model.id) ?? { amount: 0, count: 0 };
      const access = accessByCreator.get(model.id) ?? { amount: 0, count: 0 };
      const gallery = galleryByCreator.get(model.id) ?? { amount: 0, count: 0 };
      const payouts =
        payoutsByCreator.get(model.id) ?? {
          pending: 0,
          approved: 0,
          paid: 0,
          rejected: 0,
          count: 0,
        };
      const gross = tips.amount + access.amount + gallery.amount;
      const creatorNet = Math.round(gross * netMultiplier);
      const platformFee = gross - creatorNet;
      const taxIncluded = taxPercent > 0
        ? Math.round(platformFee * (taxPercent / (100 + taxPercent)))
        : 0;
      const platformNet = platformFee - taxIncluded;
      const availablePayoutEurGross = toNumber(model.creatorBalance) * tokenEuroRate;
      const availablePayoutWithholdEur =
        availablePayoutEurGross * (payoutWithholdPercent / 100);
      return {
        model: {
          id: model.id,
          username: model.username,
          email: model.email,
          createdAt: model.createdAt.toISOString(),
        },
        grossTokens: gross,
        creatorNetTokens: creatorNet,
        platformFeeTokens: platformFee,
        taxIncludedTokens: taxIncluded,
        platformNetTokens: platformNet,
        availableForPayoutTokens: toNumber(model.creatorBalance),
        availablePayoutEurGross,
        availablePayoutWithholdEur,
        availablePayoutEurNet:
          availablePayoutEurGross - availablePayoutWithholdEur,
        payouts,
        sources: { tips, paidAccess: access, gallery },
      };
    });

    const totals = rows.reduce(
      (acc, row) => {
        acc.grossTokens += row.grossTokens;
        acc.creatorNetTokens += row.creatorNetTokens;
        acc.platformFeeTokens += row.platformFeeTokens;
        acc.taxIncludedTokens += row.taxIncludedTokens;
        acc.platformNetTokens += row.platformNetTokens;
        acc.availableForPayoutTokens += row.availableForPayoutTokens;
        acc.pendingPayoutTokens += row.payouts.pending;
        acc.approvedPayoutTokens += row.payouts.approved;
        acc.paidPayoutTokens += row.payouts.paid;
        return acc;
      },
      {
        grossTokens: 0,
        creatorNetTokens: 0,
        platformFeeTokens: 0,
        taxIncludedTokens: 0,
        platformNetTokens: 0,
        availableForPayoutTokens: 0,
        pendingPayoutTokens: 0,
        approvedPayoutTokens: 0,
        paidPayoutTokens: 0,
      },
    );

    return {
      feePercent,
      taxPercent,
      tokenEuroRate,
      payoutWithholdPercent,
      range: {
        from: fromDate && Number.isFinite(fromDate.getTime()) ? fromDate.toISOString() : null,
        to: toDate && Number.isFinite(toDate.getTime()) ? toDate.toISOString() : null,
      },
      totals,
      rows,
    };
  }
}
