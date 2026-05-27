import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Tipo evento Outbox. Tutti i payload condividono lo stesso schema atteso dall'Owner Hub.
 * `externalId` deve essere unico per piattaforma -> usiamo prefisso tipo + cuid/businessId.
 */
export type OutboxEventInput = {
  type:
    | "TIP"
    | "STREAM_ACCESS"
    | "GALLERY_PURCHASE"
    | "PAYOUT_REQUESTED"
    | "PAYOUT_PAID"
    | "OWNER_REVENUE"
    | "USER_SIGNUP"
    | "USER_LOGIN"
    | string;
  externalId: string;
  occurredAt?: Date;
  userId?: string | null;
  username?: string | null;
  amountTokens?: number | null;
  amountEur?: number | null;
  currency?: string | null;
  meta?: Record<string, unknown> | null;
};

/**
 * Outbox Service: scrittura atomica nella stessa transazione di business
 * (passa il `tx` di Prisma) e fornisce flush per il job.
 */
@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private tokenEuroRate(): number {
    const raw = this.config.get<string>("TOKEN_EUR_RATE");
    const n = raw != null ? Number(raw) : 0.05;
    if (!Number.isFinite(n) || n < 0) return 0.05;
    return n;
  }

  /** Conversione automatica token -> EUR usando TOKEN_EUR_RATE. */
  tokensToEur(tokens: number | null | undefined): number | null {
    if (tokens == null || !Number.isFinite(tokens)) return null;
    return Math.round(tokens * this.tokenEuroRate() * 10000) / 10000;
  }

  /**
   * Scrive un evento outbox. Usa `client` se passato (per transazioni),
   * altrimenti usa il prisma globale.
   */
  async write(
    client: Prisma.TransactionClient | PrismaService,
    event: OutboxEventInput,
  ): Promise<void> {
    const payload: Record<string, unknown> = {
      type: event.type,
      externalId: event.externalId,
      occurredAt: (event.occurredAt ?? new Date()).toISOString(),
      userId: event.userId ?? null,
      username: event.username ?? null,
      amountTokens: event.amountTokens ?? null,
      amountEur: event.amountEur ?? null,
      currency: event.currency ?? "EUR",
      meta: event.meta ?? null,
    };

    try {
      await client.outboxEvent.create({
        data: {
          type: event.type,
          externalId: event.externalId,
          payload: payload as Prisma.InputJsonValue,
          occurredAt: event.occurredAt ?? new Date(),
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Unique constraint") || msg.includes("P2002")) {
        // Idempotenza: evento gia' registrato. Ignoriamo.
        return;
      }
      this.logger.error(
        `outbox write fallita per externalId=${event.externalId}: ${msg}`,
      );
      // NON rilanciamo: l'evento di business non deve fallire per problemi di analytics.
    }
  }
}
