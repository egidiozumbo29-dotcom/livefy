import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Flusher: ogni N secondi prende eventi non inviati e li POSTa al hub.
 * Backoff esponenziale: ritenta dopo (2^attempts * 30s), max 24h.
 */
@Injectable()
export class OutboxFlusher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxFlusher.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private hubUrl(): string | null {
    return this.config.get<string>("OWNER_HUB_URL") ?? null;
  }
  private hubToken(): string | null {
    return this.config.get<string>("OWNER_INGEST_TOKEN") ?? null;
  }
  private platformId(): string {
    return this.config.get<string>("OWNER_PLATFORM_ID") ?? "livefy";
  }
  private platformName(): string {
    return this.config.get<string>("OWNER_PLATFORM_NAME") ?? "Livefy";
  }
  private platformApiUrl(): string | null {
    return this.config.get<string>("OWNER_PLATFORM_API_URL") ?? null;
  }
  private intervalMs(): number {
    const raw = this.config.get<string>("OWNER_FLUSH_INTERVAL_MS");
    const n = raw != null ? Number(raw) : 30_000;
    if (!Number.isFinite(n) || n < 5_000) return 30_000;
    return n;
  }
  private batchSize(): number {
    const raw = this.config.get<string>("OWNER_FLUSH_BATCH");
    const n = raw != null ? Number(raw) : 100;
    if (!Number.isFinite(n) || n < 1 || n > 500) return 100;
    return n;
  }

  onModuleInit(): void {
    if (!this.hubUrl() || !this.hubToken()) {
      this.logger.warn(
        "Owner Hub non configurato (OWNER_HUB_URL / OWNER_INGEST_TOKEN mancanti) — flusher disabilitato.",
      );
      return;
    }
    this.scheduleNext();
  }

  onModuleDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  private scheduleNext(): void {
    this.timer = setTimeout(() => {
      void this.tick();
    }, this.intervalMs());
  }

  private nextDueAt(attempts: number): Date {
    // backoff: 30s * 2^attempts, max 24h
    const base = 30_000;
    const ms = Math.min(base * Math.pow(2, attempts), 24 * 60 * 60 * 1000);
    return new Date(Date.now() + ms);
  }

  private async tick(): Promise<void> {
    if (this.running) {
      this.scheduleNext();
      return;
    }
    this.running = true;
    try {
      await this.flushOnce();
    } catch (err) {
      this.logger.error(`flush error: ${err instanceof Error ? err.message : err}`);
    } finally {
      this.running = false;
      this.scheduleNext();
    }
  }

  private async flushOnce(): Promise<void> {
    const url = this.hubUrl();
    const token = this.hubToken();
    if (!url || !token) return;

    const now = new Date();
    const candidates = await this.prisma.outboxEvent.findMany({
      where: {
        sentAt: null,
        // ritentiamo solo se non c'e' lastError, oppure se e' passato il backoff (campo non persistito):
        // semplificazione: si ritenta a ogni tick. Se serve backoff persistente, aggiungere `nextAttemptAt`.
      },
      orderBy: { occurredAt: "asc" },
      take: this.batchSize(),
    });

    if (candidates.length === 0) return;

    const events = candidates.map((e) => {
      const payload = (e.payload ?? {}) as Record<string, unknown>;
      return {
        externalId: e.externalId,
        type: e.type,
        occurredAt:
          (payload.occurredAt as string | undefined) ??
          e.occurredAt.toISOString(),
        userId: (payload.userId as string | undefined) ?? null,
        username: (payload.username as string | undefined) ?? null,
        amountTokens: (payload.amountTokens as number | undefined) ?? null,
        amountEur: (payload.amountEur as number | undefined) ?? null,
        currency: (payload.currency as string | undefined) ?? null,
        meta: (payload.meta as Record<string, unknown> | undefined) ?? null,
      };
    });

    const body = {
      platform: {
        id: this.platformId(),
        name: this.platformName(),
        apiUrl: this.platformApiUrl(),
      },
      events,
    };

    let response: Response;
    try {
      response = await fetch(`${url.replace(/\/$/, "")}/api/events`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`POST hub fallito: ${msg}`);
      await this.prisma.outboxEvent.updateMany({
        where: { id: { in: candidates.map((c) => c.id) } },
        data: { attempts: { increment: 1 }, lastError: msg.slice(0, 500) },
      });
      return;
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      const msg = `HTTP ${response.status}: ${text.slice(0, 300)}`;
      this.logger.warn(`hub ha rifiutato il batch: ${msg}`);
      await this.prisma.outboxEvent.updateMany({
        where: { id: { in: candidates.map((c) => c.id) } },
        data: { attempts: { increment: 1 }, lastError: msg.slice(0, 500) },
      });
      return;
    }

    await this.prisma.outboxEvent.updateMany({
      where: { id: { in: candidates.map((c) => c.id) } },
      data: { sentAt: now, lastError: null },
    });
    this.logger.log(`hub: inviati ${candidates.length} eventi`);
  }
}
