import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, TxMethod, TxStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  TOKEN_PACKS,
  packTotalTokens,
} from "./token-packs.catalog";

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  tokenPacks() {
    return {
      packs: TOKEN_PACKS.map((p) => {
        const totalTokens = packTotalTokens(p);
        return {
          key: p.key,
          tokens: p.tokens,
          bonusTokens: p.bonusTokens,
          totalTokens,
          cents: p.cents,
          currency: p.currency,
          shortLabel: p.shortLabel,
          badge: "badge" in p ? p.badge : undefined,
        };
      }),
    };
  }

  private revolutApiKey(): string {
    const key = this.config.get<string>("REVOLUT_API_KEY");
    if (!key) {
      throw new ServiceUnavailableException("revolut_non_configurato");
    }
    return key;
  }

  private revolutBaseUrl(): string {
    return (
      this.config.get<string>("REVOLUT_API_BASE_URL") ??
      "https://merchant.revolut.com"
    ).replace(/\/$/, "");
  }

  async createCheckoutSession(userId: string, packKey: string) {
    const pack = TOKEN_PACKS.find((p) => p.key === packKey);
    if (!pack) throw new BadRequestException("pack_sconosciuto");

    const totalTokens = packTotalTokens(pack);
    const frontend =
      this.config.get<string>("FRONTEND_URL") ?? "http://localhost:3000";

    const bonusLine =
      pack.bonusTokens > 0
        ? `Include ${pack.bonusTokens} token omaggio (${pack.tokens} + ${pack.bonusTokens}).`
        : `${totalTokens} token sul tuo balance Synthra.`;

    const order = await this.revolutRequest<{
      id?: string;
      checkout_url?: string;
      public_id?: string;
    }>("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        amount: pack.cents,
        currency: pack.currency.toUpperCase(),
        description: `${totalTokens.toLocaleString("it-IT")} token Synthra. ${bonusLine}`,
        redirect_url: `${frontend}/wallet?paid=1`,
        cancel_redirect_url: `${frontend}/wallet?cancel=1`,
        merchant_order_ext_ref: `${userId}:${pack.key}:${Date.now()}`,
        metadata: {
          userId,
          tokens: String(totalTokens),
          packKey: pack.key,
          packBaseTokens: String(pack.tokens),
          packBonusTokens: String(pack.bonusTokens),
        },
      }),
    });

    if (!order.checkout_url) {
      throw new BadRequestException("checkout_url_mancante");
    }

    return { url: order.checkout_url };
  }

  private async revolutRequest<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.revolutBaseUrl()}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${this.revolutApiKey()}`,
        "Revolut-Api-Version":
          this.config.get<string>("REVOLUT_API_VERSION") ?? "2024-09-01",
        ...(init?.headers ?? {}),
      },
    });
    const data = (await res.json().catch(() => ({}))) as {
      message?: string;
      error?: string;
    };
    if (!res.ok) {
      const message = data.message ?? data.error ?? "revolut_request_failed";
      throw new BadRequestException(message);
    }
    return data as T;
  }

  private async getRevolutOrder(orderId: string) {
    return this.revolutRequest<{
      id: string;
      state?: string;
      amount?: number;
      currency?: string;
      metadata?: {
        userId?: string;
        tokens?: string;
        packKey?: string;
      };
    }>(`/api/orders/${encodeURIComponent(orderId)}`);
  }

  async createCryptoIntent(userId: string, packKey: string, networkRaw?: string) {
    const pack = TOKEN_PACKS.find((p) => p.key === packKey);
    if (!pack) throw new BadRequestException("pack_sconosciuto");

    const network = (networkRaw || "USDT_TRC20").trim().toUpperCase();
    const walletEnvKey = `CRYPTO_WALLET_${network}`;
    const walletAddress = this.config.get<string>(walletEnvKey);
    if (!walletAddress) {
      throw new ServiceUnavailableException("crypto_non_configurato");
    }

    const totalTokens = packTotalTokens(pack);
    const amountEur = pack.cents / 100;
    const tx = await this.prisma.transaction.create({
      data: {
        userId,
        amount: new Prisma.Decimal(totalTokens),
        method: TxMethod.CRYPTO,
        status: TxStatus.PENDING,
        metadata: {
          kind: "CRYPTO_TOPUP_PENDING",
          packKey: pack.key,
          tokens: totalTokens,
          cents: pack.cents,
          currency: pack.currency,
          network,
          walletAddress,
          instructions:
            "Invia l'importo crypto concordato e contatta il supporto/admin con questo riferimento. I token vengono accreditati manualmente dopo conferma.",
        },
      },
    });

    return {
      id: tx.id,
      status: tx.status,
      packKey: pack.key,
      tokens: totalTokens,
      amountEur,
      network,
      walletAddress,
      reference: tx.id,
    };
  }

  async handleRevolutWebhook(payload: unknown) {
    const event = payload as {
      event?: string;
      type?: string;
      order_id?: string;
      data?: { id?: string; order_id?: string };
    };
    const eventType = event.event ?? event.type ?? "";
    if (eventType && !eventType.toUpperCase().includes("COMPLETED")) return;

    const orderId = event.order_id ?? event.data?.order_id ?? event.data?.id;
    if (!orderId) {
      this.logger.warn("Webhook Revolut senza order id");
      return;
    }

    const order = await this.getRevolutOrder(orderId);
    if (order.state !== "COMPLETED") return;

    const userId = order.metadata?.userId;
    const tokensRaw = order.metadata?.tokens;
    const tokens = tokensRaw ? Number(tokensRaw) : NaN;
    if (!userId || !Number.isFinite(tokens) || tokens <= 0) {
      this.logger.warn(`Webhook Revolut metadata incompleta order=${order.id}`);
      return;
    }

    const externalId = order.id;

    const existing = await this.prisma.transaction.findUnique({
      where: { externalId },
    });
    if (existing) return;

    const tokenDec = new Prisma.Decimal(tokens);

    await this.prisma.$transaction([
      this.prisma.transaction.create({
        data: {
          userId,
          amount: tokenDec,
          method: "REVOLUT" as TxMethod,
          status: TxStatus.COMPLETED,
          externalId,
          metadata: {
            cents: order.amount,
            currency: order.currency,
            packKey: order.metadata?.packKey,
          },
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { balance: { increment: tokenDec } },
      }),
    ]);
  }

  async listTransactions(userId: string, take = 50) {
    const rows = await this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: Math.min(take, 100),
    });
    return rows.map((t) => ({
      id: t.id,
      amount: Number(t.amount.toString()),
      method: t.method,
      status: t.status,
      metadata: t.metadata,
      createdAt: t.createdAt.toISOString(),
    }));
  }
}
