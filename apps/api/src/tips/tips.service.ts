import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, TxMethod, TxStatus } from "@prisma/client";
import { ChatGateway } from "../chat/chat.gateway";
import { OutboxService } from "../outbox/outbox.service";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateTipDto } from "./dto/create-tip.dto";

@Injectable()
export class TipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly chat: ChatGateway,
    private readonly outbox: OutboxService,
  ) {}

  private feePercent(): number {
    const raw = this.config.get<string>("PLATFORM_TIP_FEE_PERCENT");
    const n = raw != null ? Number(raw) : 0;
    if (!Number.isFinite(n) || n < 0 || n > 90) return 0;
    return n;
  }

  /** Sopra questo importo il feed chat mostra la tip più in evidenza. Env: CHAT_BIG_TIP_TOKENS */
  private bigTipMinTokens(): number {
    const raw = this.config.get<string>("CHAT_BIG_TIP_TOKENS");
    const n = raw != null ? Number(raw.trim()) : 250;
    if (!Number.isFinite(n) || n < 1) return 250;
    return n;
  }

  async sendTip(senderId: string, dto: CreateTipDto) {
    if (senderId === dto.receiverId) {
      throw new BadRequestException("tip_a_se_stessi");
    }

    const amountDec = new Prisma.Decimal(dto.amount);
    const feePct = this.feePercent();
    const netMul = new Prisma.Decimal(100 - feePct).div(100);

    const result = await this.prisma.$transaction(async (tx) => {
      const sender = await tx.user.findUnique({
        where: { id: senderId },
        select: { id: true, username: true, balance: true, banned: true },
      });
      const receiver = await tx.user.findUnique({
        where: { id: dto.receiverId },
        select: { id: true, username: true, banned: true },
      });
      if (!sender || sender.banned) throw new NotFoundException();
      if (!receiver || receiver.banned) throw new NotFoundException();

      if (sender.balance.lt(amountDec)) {
        throw new BadRequestException("saldo_insufficiente");
      }

      let roomId: string | null = null;
      if (dto.streamId) {
        const stream = await tx.stream.findFirst({
          where: {
            id: dto.streamId,
            status: "LIVE",
            userId: dto.receiverId,
          },
          select: { id: true, roomId: true },
        });
        if (!stream) {
          throw new BadRequestException("stream_non_valido");
        }
        roomId = stream.roomId;
      }

      const net = amountDec.mul(netMul);

      await tx.user.update({
        where: { id: senderId },
        data: { balance: { decrement: amountDec } },
      });
      // Accredito al wallet creator (non al wallet viewer): cosi il netto e'
      // disponibile per le richieste di payout.
      await tx.user.update({
        where: { id: dto.receiverId },
        data: { creatorBalance: { increment: net } },
      });
      const tip = await tx.tip.create({
        data: {
          senderId,
          receiverId: dto.receiverId,
          streamId: dto.streamId ?? null,
          amount: amountDec,
        },
      });
      // Outbox: invia evento TIP all'Owner Hub (atomico con la transazione di business)
      const amountTokens = Number(amountDec.toString());
      await this.outbox.write(tx, {
        type: "TIP",
        externalId: `tip_${tip.id}`,
        occurredAt: tip.createdAt,
        userId: receiver.id,
        username: receiver.username,
        amountTokens,
        amountEur: this.outbox.tokensToEur(amountTokens),
        meta: {
          senderId,
          senderUsername: sender.username,
          streamId: dto.streamId ?? null,
        },
      });
      /** Ledger spender: cronologia wallet / coerenza contabile. */
      await tx.transaction.create({
        data: {
          userId: senderId,
          amount: amountDec.negated(),
          method: TxMethod.INTERNAL,
          status: TxStatus.COMPLETED,
          externalId: `tip_out_${tip.id}`,
          metadata: {
            kind: "TIP_OUT",
            tipId: tip.id,
            receiverId: receiver.id,
            receiverUsername: receiver.username,
            streamId: dto.streamId ?? null,
          },
        },
      });
      return {
        tip,
        senderUsername: sender.username,
        roomId,
      };
    });

    // Broadcast tip su socket per la stanza live (animazione + tip line in chat)
    if (result.roomId) {
      const amt = Number(amountDec.toString());
      await this.chat.broadcastTip(result.roomId, {
        username: result.senderUsername,
        amount: amt,
        streamId: dto.streamId ?? null,
        bigTip: amt >= this.bigTipMinTokens(),
      });
    }

    return { ok: true };
  }

  async tipFeed(receiverId: string, take = 30) {
    const rows = await this.prisma.tip.findMany({
      where: { receiverId },
      orderBy: { createdAt: "desc" },
      take: Math.min(take, 100),
      select: {
        id: true,
        amount: true,
        createdAt: true,
        sender: {
          select: { id: true, username: true, avatarUrl: true },
        },
      },
    });
    return rows.map((t) => ({
      id: t.id,
      amount: Number(t.amount.toString()),
      createdAt: t.createdAt.toISOString(),
      sender: t.sender,
    }));
  }

  /** Top tipper della live corrente (somma per sender, ordina desc). */
  async tipLeaderboardForStream(streamId: string, take = 10) {
    const groups = await this.prisma.tip.groupBy({
      by: ["senderId"],
      where: { streamId },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: Math.min(take, 50),
    });
    if (!groups.length) return [];
    const senders = await this.prisma.user.findMany({
      where: { id: { in: groups.map((g) => g.senderId) } },
      select: { id: true, username: true, avatarUrl: true },
    });
    const senderMap = new Map(senders.map((s) => [s.id, s]));
    return groups.map((g, idx) => ({
      rank: idx + 1,
      sender: senderMap.get(g.senderId) ?? {
        id: g.senderId,
        username: "anon",
        avatarUrl: null,
      },
      tokens: Number(g._sum.amount?.toString() ?? "0"),
    }));
  }
}
