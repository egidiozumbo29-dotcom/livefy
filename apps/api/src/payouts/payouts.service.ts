import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PayoutStatus, Prisma } from "@prisma/client";
import { OutboxService } from "../outbox/outbox.service";
import { PrismaService } from "../prisma/prisma.service";
import type { CreatePayoutDto } from "./dto/create-payout.dto";

const ADMIN_PAYOUT_TRANSITIONS = new Set([
  `${PayoutStatus.PENDING}->${PayoutStatus.APPROVED}`,
  `${PayoutStatus.PENDING}->${PayoutStatus.PAID}`,
  `${PayoutStatus.PENDING}->${PayoutStatus.REJECTED}`,
  `${PayoutStatus.APPROVED}->${PayoutStatus.PAID}`,
  `${PayoutStatus.APPROVED}->${PayoutStatus.REJECTED}`,
]);

@Injectable()
export class PayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly outbox: OutboxService,
  ) {}

  /** Token minimi richiedibili per un singolo payout. */
  private minPayoutTokens(): number {
    const raw = this.config.get<string>("MIN_PAYOUT_TOKENS");
    const n = raw != null ? Number(raw) : 1000;
    if (!Number.isFinite(n) || n < 1) return 1000;
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

  async getStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { creatorBalance: true, balance: true },
    });
    if (!user) throw new NotFoundException();
    const pendingAgg = await this.prisma.payoutRequest.aggregate({
      where: {
        userId,
        status: { in: [PayoutStatus.PENDING, PayoutStatus.APPROVED] },
      },
      _sum: { amount: true },
    });
    const totalPaidAgg = await this.prisma.payoutRequest.aggregate({
      where: { userId, status: PayoutStatus.PAID },
      _sum: { amount: true },
    });
    return {
      tokenBalance: Number(user.balance.toString()),
      creatorBalance: Number(user.creatorBalance.toString()),
      pending: Number(pendingAgg._sum.amount?.toString() ?? "0"),
      totalPaid: Number(totalPaidAgg._sum.amount?.toString() ?? "0"),
      minPayout: this.minPayoutTokens(),
    };
  }

  async listMine(userId: string) {
    const rows = await this.prisma.payoutRequest.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return rows.map((r) => ({
      id: r.id,
      amount: Number(r.amount.toString()),
      method: r.method,
      destination: r.destination,
      status: r.status,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
      paidAt: r.paidAt?.toISOString() ?? null,
    }));
  }

  async request(userId: string, dto: CreatePayoutDto) {
    const amountDec = new Prisma.Decimal(dto.amount);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { creatorBalance: true },
      });
      if (!user) throw new NotFoundException();
      const min = this.minPayoutTokens();
      if (dto.amount < min && user.creatorBalance.gte(min)) {
        throw new BadRequestException({
          message: "amount_below_min",
          minPayout: min,
        });
      }
      const r = await tx.user.updateMany({
        where: { id: userId, creatorBalance: { gte: amountDec } },
        data: { creatorBalance: { decrement: amountDec } },
      });
      if (r.count === 0) {
        throw new HttpException(
          { message: "creator_balance_insufficiente" },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
      const req = await tx.payoutRequest.create({
        data: {
          userId,
          amount: amountDec,
          method: dto.method?.trim() || "manual",
          destination: dto.destination?.trim() || null,
          note: dto.note?.trim() || null,
          status: PayoutStatus.PENDING,
        },
      });
      // Outbox: PAYOUT_REQUESTED
      const tokens = Number(amountDec.toString());
      const eurGross = tokens * this.tokenEuroRate();
      const userMin = await tx.user.findUnique({
        where: { id: userId },
        select: { username: true },
      });
      await this.outbox.write(tx, {
        type: "PAYOUT_REQUESTED",
        externalId: `payout_req_${req.id}`,
        occurredAt: req.createdAt,
        userId,
        username: userMin?.username ?? null,
        amountTokens: tokens,
        amountEur: Math.round(eurGross * 10000) / 10000,
        meta: {
          method: req.method,
          destination: req.destination,
        },
      });
      return req;
    });

    return {
      id: result.id,
      amount: Number(result.amount.toString()),
      method: result.method,
      status: result.status,
      createdAt: result.createdAt.toISOString(),
    };
  }

  /** Lista richieste per back-office (admin). */
  async listForAdmin(status?: PayoutStatus, take = 50) {
    const t = Math.min(Math.max(take, 1), 100);
    const tokenEuroRate = this.tokenEuroRate();
    const withholdPercent = this.payoutWithholdPercent();
    const rows = await this.prisma.payoutRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: t,
      include: {
        user: { select: { id: true, username: true, email: true } },
      },
    });
    return rows.map((r) => {
      const amount = Number(r.amount.toString());
      const amountEurGross = amount * tokenEuroRate;
      const withholdEur = amountEurGross * (withholdPercent / 100);
      const amountEurNet = amountEurGross - withholdEur;
      return {
        id: r.id,
        userId: r.userId,
        user: r.user,
        amount,
        amountEur: amountEurGross,
        amountEurGross,
        withholdPercent,
        withholdEur,
        amountEurNet,
        tokenEuroRate,
        method: r.method,
        destination: r.destination,
        status: r.status,
        note: r.note,
        createdAt: r.createdAt.toISOString(),
        paidAt: r.paidAt?.toISOString() ?? null,
      };
    });
  }

  /**
   * Aggiorna stato payout: su REJECTED rimborsa il creatorBalance.
   * PAID imposta paidAt.
   */
  async adminSetStatus(id: string, next: PayoutStatus) {
    const row = await this.prisma.payoutRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException();
    const key = `${row.status}->${next}`;
    if (!ADMIN_PAYOUT_TRANSITIONS.has(key)) {
      throw new BadRequestException("transizione_stato_non_valida");
    }
    if (next === PayoutStatus.REJECTED) {
      await this.prisma.$transaction(async (tx) => {
        const amountDec = row.amount;
        await tx.user.update({
          where: { id: row.userId },
          data: { creatorBalance: { increment: amountDec } },
        });
        await tx.payoutRequest.update({
          where: { id },
          data: { status: PayoutStatus.REJECTED },
        });
      });
    } else if (next === PayoutStatus.APPROVED) {
      await this.prisma.payoutRequest.update({
        where: { id },
        data: { status: PayoutStatus.APPROVED },
      });
    } else if (next === PayoutStatus.PAID) {
      const paidAt = new Date();
      await this.prisma.payoutRequest.update({
        where: { id },
        data: { status: PayoutStatus.PAID, paidAt },
      });
      // Outbox: PAYOUT_PAID (uscita) + OWNER_REVENUE (trattenuta netta)
      const tokens = Number(row.amount.toString());
      const eurGross = tokens * this.tokenEuroRate();
      const withholdPct = this.payoutWithholdPercent();
      const ownerEur = eurGross * (withholdPct / 100);
      const paidEur = eurGross - ownerEur;
      const userMin = await this.prisma.user.findUnique({
        where: { id: row.userId },
        select: { username: true },
      });
      await this.outbox.write(this.prisma, {
        type: "PAYOUT_PAID",
        externalId: `payout_paid_${row.id}`,
        occurredAt: paidAt,
        userId: row.userId,
        username: userMin?.username ?? null,
        amountTokens: tokens,
        amountEur: Math.round(paidEur * 10000) / 10000,
        meta: {
          tokenEuroRate: this.tokenEuroRate(),
          withholdPercent: withholdPct,
          grossEur: Math.round(eurGross * 10000) / 10000,
        },
      });
      await this.outbox.write(this.prisma, {
        type: "OWNER_REVENUE",
        externalId: `owner_rev_${row.id}`,
        occurredAt: paidAt,
        userId: row.userId,
        username: userMin?.username ?? null,
        amountEur: Math.round(ownerEur * 10000) / 10000,
        meta: {
          source: "PAYOUT_WITHHOLD",
          payoutId: row.id,
          withholdPercent: withholdPct,
        },
      });
    }
    const updated = await this.prisma.payoutRequest.findUnique({
      where: { id },
      include: { user: { select: { id: true, username: true, email: true } } },
    });
    if (!updated) throw new NotFoundException();
    return {
      id: updated.id,
      userId: updated.userId,
      user: updated.user,
      amount: Number(updated.amount.toString()),
      method: updated.method,
      destination: updated.destination,
      status: updated.status,
      note: updated.note,
      createdAt: updated.createdAt.toISOString(),
      paidAt: updated.paidAt?.toISOString() ?? null,
    };
  }
}
