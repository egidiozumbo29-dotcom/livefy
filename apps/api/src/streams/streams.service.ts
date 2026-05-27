import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, ShowMode } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { ChatGateway } from "../chat/chat.gateway";
import { NotificationsService } from "../notifications/notifications.service";
import { OutboxService } from "../outbox/outbox.service";
import { PrismaService } from "../prisma/prisma.service";
import { LivekitService } from "./livekit.service";
import type { StartStreamDto } from "./dto/start-stream.dto";
import type { UpdateLiveDto } from "./dto/update-live.dto";

@Injectable()
export class StreamsService {
  private readonly log = new Logger(StreamsService.name);
  private static readonly REQUEST_TTL_MS = 90_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly livekit: LivekitService,
    private readonly chat: ChatGateway,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly outbox: OutboxService,
  ) {}

  /**
   * Helper: emette un evento STREAM_ACCESS nell'outbox per una nuova
   * StreamAccess o per un tick di rebill (passare `recurring=true`).
   */
  private async emitStreamAccessEvent(
    tx: Prisma.TransactionClient,
    args: {
      accessId: string;
      streamId: string;
      creatorId: string;
      mode: string;
      pricePaid: number;
      recurring?: boolean;
      occurredAt?: Date;
    },
  ) {
    const creator = await tx.user.findUnique({
      where: { id: args.creatorId },
      select: { username: true },
    });
    await this.outbox.write(tx, {
      type: "STREAM_ACCESS",
      externalId: args.recurring
        ? `stream_access_tick_${args.accessId}_${Date.now()}`
        : `stream_access_${args.accessId}`,
      occurredAt: args.occurredAt ?? new Date(),
      userId: args.creatorId,
      username: creator?.username ?? null,
      amountTokens: args.pricePaid,
      amountEur: this.outbox.tokensToEur(args.pricePaid),
      meta: {
        streamId: args.streamId,
        accessId: args.accessId,
        mode: args.mode,
        recurring: !!args.recurring,
      },
    });
  }

  /** Frazione netta per il creator: (1 - fee%) */
  private creatorNetMul(): Prisma.Decimal {
    const raw = this.config.get<string>("PLATFORM_TIP_FEE_PERCENT");
    let pct = raw != null ? Number(raw) : 0;
    if (!Number.isFinite(pct) || pct < 0 || pct > 90) pct = 0;
    return new Prisma.Decimal(100 - pct).div(100);
  }

  private normalizeLiveTags(tags?: string[]) {
    if (!tags) return undefined;
    return Array.from(
      new Set(
        tags
          .map((tag) => tag.trim().replace(/^#/, "").toLowerCase())
          .filter((tag) => tag.length >= 2 && tag.length <= 32),
      ),
    ).slice(0, 12);
  }

  async listLive() {
    try {
      const rows = await this.prisma.stream.findMany({
        where: {
          status: "LIVE",
          isPrivate: false,
          passwordHash: null,
        },
        orderBy: [{ viewers: "desc" }, { startedAt: "desc" }],
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              category: true,
              tags: true,
              language: true,
              country: true,
            },
          },
        },
      });

      // Somma dei tip per ogni live attiva (per progress bar tip-goal)
      const tipSums = rows.length
        ? await this.prisma.tip.groupBy({
            by: ["streamId"],
            where: {
              streamId: { in: rows.map((r) => r.id) },
            },
            _sum: { amount: true },
          })
        : [];
      const tipMap = new Map<string, number>();
      for (const t of tipSums) {
        if (!t.streamId) continue;
        tipMap.set(t.streamId, Number(t._sum.amount?.toString() ?? "0"));
      }

      return rows.map((s) => ({
        id: s.user.id,
        streamId: s.id,
        room: s.roomId,
        title: s.title,
        subject: s.title || s.user.username,
        viewers: s.viewers,
        thumbnail: s.thumbnail,
        startedAt: s.startedAt?.toISOString() ?? null,
        showMode: s.showMode,
        basePrice: s.basePrice,
        privatePricePerMinute: s.privatePricePerMinute,
        chatOpen: s.chatOpen,
        tipsTotal: tipMap.get(s.id) ?? 0,
        creator: s.user,
      }));
    } catch (err) {
      this.log.error(
        "listLive fallito (DB o schema): restituisco lista vuota",
        err instanceof Error ? err.stack : String(err),
      );
      return [];
    }
  }

  async startLive(userId: string, dto: StartStreamDto) {
    let passwordHash: string | null = null;
    if (dto.roomPassword?.trim()) {
      passwordHash = await bcrypt.hash(dto.roomPassword.trim(), 10);
    }

    const stream = await this.prisma.$transaction(async (tx) => {
      await tx.stream.updateMany({
        where: { userId, status: "LIVE" },
        data: { status: "ENDED", endedAt: new Date(), roomId: null },
      });

      const cleanTags = this.normalizeLiveTags(dto.tags);
      if (dto.category !== undefined || cleanTags !== undefined) {
        await tx.user.update({
          where: { id: userId },
          data: {
            ...(dto.category !== undefined
              ? { category: dto.category.trim() || null }
              : {}),
            ...(cleanTags !== undefined ? { tags: cleanTags } : {}),
          },
        });
      }

      const roomId = `live-${userId}`;
      const showMode = dto.showMode ?? ShowMode.PUBLIC;
      // Prezzi preimpostabili anche in PUBLIC per richieste private show
      const basePrice = dto.basePrice ?? 0;
      const privatePricePerMinute = dto.privatePricePerMinute ?? 0;

      // spyPricePerMinute usato quando un privato normale accettato consente spy
      const spyPricePerMinute = Math.max(0, dto.spyPricePerMinute ?? 0);

      return tx.stream.create({
        data: {
          userId,
          title: dto.title?.trim() ?? "",
          thumbnail: dto.thumbnail?.trim(),
          status: "LIVE",
          startedAt: new Date(),
          roomId,
          isPrivate: dto.isPrivate ?? false,
          passwordHash,
          showMode,
          basePrice,
          privatePricePerMinute,
          spyPricePerMinute,
          chatOpen: dto.chatOpen ?? true,
        },
      });
    });

    if (stream.roomId) {
      void this.chat.broadcastLiveState(stream.roomId);
    }

    void this.notifications
      .notifyFollowersCreatorLive(userId, stream.id, stream.title ?? "")
      .catch(() => {
        /* best effort */
      });

    return {
      success: true,
      streamId: stream.id,
      room: stream.roomId,
      showMode: stream.showMode,
      basePrice: stream.basePrice,
      privatePricePerMinute: stream.privatePricePerMinute,
      spyPricePerMinute: stream.spyPricePerMinute,
      chatOpen: stream.chatOpen,
    };
  }

  async stopLive(userId: string) {
    const live = await this.prisma.stream.findFirst({
      where: { userId, status: "LIVE" },
      select: { roomId: true, livekitIngressId: true },
    });
    if (live?.livekitIngressId) {
      void this.livekit.deleteIngress(live.livekitIngressId).catch(() => {
        /* best effort */
      });
    }
    await this.prisma.stream.updateMany({
      where: { userId, status: "LIVE" },
      data: { status: "ENDED", endedAt: new Date(), livekitIngressId: null, roomId: null },
    });
    if (live?.roomId) {
      void this.chat.broadcastLiveState(live.roomId);
    }
    return { success: true };
  }

  async getMyLive(userId: string) {
    const stream = await this.prisma.stream.findFirst({
      where: { userId, status: "LIVE" },
      include: {
        user: {
          select: { category: true, tags: true },
        },
      },
    });
    if (!stream) return { live: null };

    let obs: { rtmpUrl: string; streamKey: string } | null = null;
    if (stream.livekitIngressId) {
      try {
        const ing = await this.livekit.getIngressById(stream.livekitIngressId);
        if (ing?.url && ing?.streamKey) {
          obs = { rtmpUrl: ing.url, streamKey: ing.streamKey };
        }
      } catch {
        obs = null;
      }
    }

    return {
      live: {
        id: stream.id,
        room: stream.roomId,
        title: stream.title,
        thumbnail: stream.thumbnail,
        viewers: stream.viewers,
        showMode: stream.showMode,
        basePrice: stream.basePrice,
        privatePricePerMinute: stream.privatePricePerMinute,
        spyPricePerMinute: stream.spyPricePerMinute,
        chatOpen: stream.chatOpen,
        isPrivate: stream.isPrivate,
        category: stream.user.category,
        tags: stream.user.tags,
        hasRoomPassword: !!stream.passwordHash,
        startedAt: stream.startedAt?.toISOString() ?? null,
        obs,
      },
    };
  }

  /** Crea (o rigenera) ingress RTMP per OBS nella stanza live corrente. */
  async createObsIngress(userId: string) {
    const stream = await this.prisma.stream.findFirst({
      where: { userId, status: "LIVE" },
    });
    if (!stream?.roomId) {
      throw new NotFoundException("nessuna_live_in_corso");
    }

    if (stream.livekitIngressId) {
      try {
        await this.livekit.deleteIngress(stream.livekitIngressId);
      } catch {
        /* sostituiamo */
      }
    }

    const info = await this.livekit.createRtmpIngress({
      roomName: stream.roomId,
      participantIdentity: `obs-${userId}`,
      participantName: "OBS Studio",
    });

    await this.prisma.stream.update({
      where: { id: stream.id },
      data: { livekitIngressId: info.ingressId },
    });

    return {
      ingressId: info.ingressId,
      rtmpUrl: info.url,
      streamKey: info.streamKey,
      room: stream.roomId,
    };
  }

  /** Rimuove l'ingress OBS senza chiudere la live (torna al solo browser). */
  async removeObsIngress(userId: string) {
    const stream = await this.prisma.stream.findFirst({
      where: { userId, status: "LIVE" },
    });
    if (!stream?.livekitIngressId) {
      throw new NotFoundException("ingress_obs_non_attivo");
    }
    try {
      await this.livekit.deleteIngress(stream.livekitIngressId);
    } catch {
      /* ok */
    }
    await this.prisma.stream.update({
      where: { id: stream.id },
      data: { livekitIngressId: null },
    });
    return { success: true };
  }

  async updateMyLive(userId: string, dto: UpdateLiveDto) {
    const live = await this.prisma.stream.findFirst({
      where: { userId, status: "LIVE" },
    });
    if (!live) {
      throw new NotFoundException("nessuna_live_in_corso");
    }

    let nextPasswordHash: string | null | undefined = undefined;
    if (dto.clearRoomPassword === true) {
      nextPasswordHash = null;
    } else if (dto.roomPassword?.trim()) {
      nextPasswordHash = await bcrypt.hash(dto.roomPassword.trim(), 10);
    }

    // Determina la modalita risultante (puo' anche non cambiare).
    const nextMode = dto.showMode ?? live.showMode;
    const modeChanged =
      dto.showMode !== undefined && dto.showMode !== live.showMode;

    const updated = await this.prisma.$transaction(async (tx) => {
      const cleanTags = this.normalizeLiveTags(dto.tags);
      if (dto.category !== undefined || cleanTags !== undefined) {
        await tx.user.update({
          where: { id: userId },
          data: {
            ...(dto.category !== undefined
              ? { category: dto.category.trim() || null }
              : {}),
            ...(cleanTags !== undefined ? { tags: cleanTags } : {}),
          },
        });
      }

      const next = await tx.stream.update({
        where: { id: live.id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.thumbnail !== undefined
            ? { thumbnail: dto.thumbnail.trim() }
            : {}),
          ...(dto.showMode !== undefined ? { showMode: dto.showMode } : {}),
          // Prezzi preimpostabili anche se la live resta pubblica.
          ...(dto.basePrice !== undefined ? { basePrice: dto.basePrice } : {}),
          // Tariffa usata per richieste private accettate dalla streamer.
          ...(dto.privatePricePerMinute !== undefined
            ? { privatePricePerMinute: dto.privatePricePerMinute }
            : {}),
          // Tariffa spy usata durante un privato normale accettato.
          ...(dto.spyPricePerMinute !== undefined
            ? { spyPricePerMinute: Math.max(0, dto.spyPricePerMinute) }
            : {}),
          ...(dto.chatOpen !== undefined ? { chatOpen: dto.chatOpen } : {}),
          ...(dto.isPrivate !== undefined ? { isPrivate: dto.isPrivate } : {}),
          ...(nextPasswordHash !== undefined
            ? { passwordHash: nextPasswordHash }
            : {}),
        },
      });

      // Se la streamer esce dalla modalita PRIVATE, libera il lock 1v1
      if (nextMode !== ShowMode.PRIVATE && next.currentPrivateViewerId) {
        await tx.stream.update({
          where: { id: next.id },
          data: { currentPrivateViewerId: null },
        });
      }
      // Cambio modalita: termina TUTTI i ticket attivi (BASE / PREMIUM)
      if (modeChanged) {
        await tx.streamAccess.updateMany({
          where: { streamId: next.id, endedAt: null },
          data: { endedAt: new Date() },
        });
      }
      return next;
    });

    if (updated.roomId) {
      void this.chat.broadcastLiveState(updated.roomId);
    }
    return {
      id: updated.id,
      room: updated.roomId,
      title: updated.title,
      thumbnail: updated.thumbnail,
      viewers: updated.viewers,
      showMode: updated.showMode,
      basePrice: updated.basePrice,
      privatePricePerMinute: updated.privatePricePerMinute,
      spyPricePerMinute: updated.spyPricePerMinute,
      chatOpen: updated.chatOpen,
      isPrivate: updated.isPrivate,
      category: dto.category !== undefined ? dto.category.trim() || null : undefined,
      tags: dto.tags !== undefined ? this.normalizeLiveTags(dto.tags) : undefined,
      hasRoomPassword: !!updated.passwordHash,
    };
  }

  // ---------- Show access (BASE + PRIVATE 1v1) ----------

  /** Stato accesso del viewer corrente per la live di un creator. */
  async getMyAccess(viewerId: string, creatorId: string) {
    const creator = await this.prisma.user.findFirst({
      where: { OR: [{ id: creatorId }, { username: creatorId }] },
      select: { id: true },
    });
    if (!creator) {
      return { live: false as const };
    }
    const stream = await this.prisma.stream.findFirst({
      where: { userId: creator.id, status: "LIVE" },
      select: {
        id: true,
        roomId: true,
        showMode: true,
        basePrice: true,
        privatePricePerMinute: true,
        spyPricePerMinute: true,
        currentPrivateViewerId: true,
        currentPrivateExclusive: true,
        userId: true,
      },
    });
    if (!stream) {
      return { live: false as const };
    }

    const isStreamer = stream.userId === viewerId;
    const baseTicket = await this.prisma.streamAccess.findFirst({
      where: {
        streamId: stream.id,
        viewerId,
        mode: ShowMode.BASE,
        endedAt: null,
      },
      select: { id: true, pricePaid: true, startedAt: true },
    });
    const privateTicket = await this.prisma.streamAccess.findFirst({
      where: {
        streamId: stream.id,
        viewerId,
        mode: ShowMode.PRIVATE,
        endedAt: null,
      },
      select: { id: true, pricePaid: true, startedAt: true },
    });
    const spyTicket = await this.prisma.streamAccess.findFirst({
      where: {
        streamId: stream.id,
        viewerId,
        mode: ShowMode.SPY,
        endedAt: null,
      },
      select: { id: true, pricePaid: true, startedAt: true },
    });

    return {
      live: true as const,
      streamId: stream.id,
      showMode: stream.showMode,
      basePrice: stream.basePrice,
      privatePricePerMinute: stream.privatePricePerMinute,
      spyPricePerMinute: stream.spyPricePerMinute,
      isStreamer,
      hasBaseTicket: !!baseTicket,
      isInPrivate:
        stream.currentPrivateViewerId === viewerId && !!privateTicket,
      streamerInPrivate: isStreamer && !!stream.currentPrivateViewerId,
      privateStartedAt: privateTicket?.startedAt?.toISOString() ?? null,
      currentPrivateViewerId: stream.currentPrivateViewerId,
      privateLocked: !!stream.currentPrivateViewerId && !isStreamer,
      privateExclusive: stream.currentPrivateExclusive,
      privateTicketId: privateTicket?.id ?? null,
      privatePricePaid: privateTicket?.pricePaid ?? 0,
      isSpying: !!spyTicket,
      spyTicketId: spyTicket?.id ?? null,
      spyPricePaid: spyTicket?.pricePaid ?? 0,
      // gli spia possono attivarsi SOLO durante un Premium 1v1 attivo
      spyAvailable:
        stream.showMode === ShowMode.PRIVATE &&
        stream.spyPricePerMinute > 0 &&
        !!stream.currentPrivateViewerId &&
        !stream.currentPrivateExclusive &&
        stream.currentPrivateViewerId !== viewerId &&
        !isStreamer,
    };
  }

  /** SPY: viewer paga il primo minuto ridotto e ottiene il diritto di guardare il Premium 1v1 senza chat. */
  async startSpy(viewerId: string, streamId: string) {
    const stream = await this.prisma.stream.findUnique({
      where: { id: streamId },
      select: {
        id: true,
        roomId: true,
        userId: true,
        status: true,
        showMode: true,
        spyPricePerMinute: true,
        currentPrivateViewerId: true,
        currentPrivateExclusive: true,
      },
    });
    if (!stream || stream.status !== "LIVE") {
      throw new NotFoundException("live_offline");
    }
    if (stream.userId === viewerId) {
      throw new BadRequestException("sei_la_streamer");
    }
    if (stream.showMode !== ShowMode.PRIVATE) {
      throw new BadRequestException("spy_non_attivo");
    }
    if (stream.spyPricePerMinute <= 0) {
      throw new BadRequestException("spy_non_configurato");
    }
    if (!stream.currentPrivateViewerId) {
      throw new BadRequestException("nessun_premium_in_corso");
    }
    if (stream.currentPrivateExclusive) {
      throw new BadRequestException("premium_esclusivo");
    }
    if (stream.currentPrivateViewerId === viewerId) {
      throw new BadRequestException("sei_in_premium");
    }

    const price = stream.spyPricePerMinute;

    return this.prisma.$transaction(async (tx) => {
      const priceDec = new Prisma.Decimal(price);
      const r = await tx.user.updateMany({
        where: { id: viewerId, balance: { gte: priceDec } },
        data: { balance: { decrement: priceDec } },
      });
      if (r.count === 0) {
        throw new HttpException(
          { message: "balance_insufficiente" },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
      const net = priceDec.mul(this.creatorNetMul());
      await tx.user.update({
        where: { id: stream.userId },
        data: { creatorBalance: { increment: net } },
      });

      let access = await tx.streamAccess.findFirst({
        where: {
          streamId: stream.id,
          viewerId,
          mode: ShowMode.SPY,
          endedAt: null,
        },
      });
      const isNew = !access;
      if (!access) {
        access = await tx.streamAccess.create({
          data: {
            streamId: stream.id,
            viewerId,
            mode: ShowMode.SPY,
            pricePaid: price,
          },
        });
      } else {
        access = await tx.streamAccess.update({
          where: { id: access.id },
          data: { pricePaid: { increment: price } },
        });
      }
      await this.emitStreamAccessEvent(tx, {
        accessId: access.id,
        streamId: stream.id,
        creatorId: stream.userId,
        mode: ShowMode.SPY,
        pricePaid: price,
        recurring: !isNew,
      });
      return { access };
    });
  }

  /** Heartbeat spy ogni 60s. */
  async tickSpy(viewerId: string, streamId: string) {
    const stream = await this.prisma.stream.findUnique({
      where: { id: streamId },
      select: {
        id: true,
        userId: true,
        showMode: true,
        spyPricePerMinute: true,
        currentPrivateViewerId: true,
        currentPrivateExclusive: true,
      },
    });
    if (!stream) throw new NotFoundException();
    if (
      stream.showMode !== ShowMode.PRIVATE ||
      !stream.currentPrivateViewerId ||
      stream.currentPrivateExclusive
    ) {
      throw new ForbiddenException("spy_chiuso");
    }
    const price = stream.spyPricePerMinute;
    if (price <= 0) {
      throw new ForbiddenException("spy_non_configurato");
    }

    return this.prisma.$transaction(async (tx) => {
      const priceDec = new Prisma.Decimal(price);
      const r = await tx.user.updateMany({
        where: { id: viewerId, balance: { gte: priceDec } },
        data: { balance: { decrement: priceDec } },
      });
      if (r.count === 0) {
        await tx.streamAccess.updateMany({
          where: {
            streamId: stream.id,
            viewerId,
            mode: ShowMode.SPY,
            endedAt: null,
          },
          data: { endedAt: new Date() },
        });
        throw new HttpException(
          { message: "balance_insufficiente", terminated: true },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
      const net = priceDec.mul(this.creatorNetMul());
      await tx.user.update({
        where: { id: stream.userId },
        data: { creatorBalance: { increment: net } },
      });
      await tx.streamAccess.updateMany({
        where: {
          streamId: stream.id,
          viewerId,
          mode: ShowMode.SPY,
          endedAt: null,
        },
        data: { pricePaid: { increment: price } },
      });
      return { ok: true, charged: price };
    });
  }

  async endSpy(viewerId: string, streamId: string) {
    await this.prisma.streamAccess.updateMany({
      where: {
        streamId,
        viewerId,
        mode: ShowMode.SPY,
        endedAt: null,
      },
      data: { endedAt: new Date() },
    });
    return { ok: true };
  }

  /** BASE: scala basePrice dal balance, crea ticket. */
  async buyBaseAccess(viewerId: string, streamId: string) {
    const stream = await this.prisma.stream.findUnique({
      where: { id: streamId },
      select: {
        id: true,
        roomId: true,
        userId: true,
        status: true,
        showMode: true,
        basePrice: true,
      },
    });
    if (!stream || stream.status !== "LIVE") {
      throw new NotFoundException("live_offline");
    }
    if (stream.userId === viewerId) {
      throw new BadRequestException("sei_la_streamer");
    }
    if (stream.showMode !== ShowMode.BASE) {
      throw new BadRequestException("show_non_base");
    }
    const price = stream.basePrice;

    const existing = await this.prisma.streamAccess.findFirst({
      where: {
        streamId: stream.id,
        viewerId,
        mode: ShowMode.BASE,
        endedAt: null,
      },
    });
    if (existing) {
      return { access: existing, alreadyOwned: true };
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (price > 0) {
          const priceDec = new Prisma.Decimal(price);
          const r = await tx.user.updateMany({
            where: {
              id: viewerId,
              balance: { gte: priceDec },
            },
            data: { balance: { decrement: priceDec } },
          });
          if (r.count === 0) {
            throw new HttpException(
              { message: "balance_insufficiente" },
              HttpStatus.PAYMENT_REQUIRED,
            );
          }
          // accredito netto al creator (creatorBalance)
          const net = priceDec.mul(this.creatorNetMul());
          await tx.user.update({
            where: { id: stream.userId },
            data: { creatorBalance: { increment: net } },
          });
        }
        const access = await tx.streamAccess.create({
          data: {
            streamId: stream.id,
            viewerId,
            mode: ShowMode.BASE,
            pricePaid: price,
          },
        });
        await this.emitStreamAccessEvent(tx, {
          accessId: access.id,
          streamId: stream.id,
          creatorId: stream.userId,
          mode: ShowMode.BASE,
          pricePaid: price,
        });
        return { access, alreadyOwned: false };
      });
    } finally {
      if (stream.roomId) {
        void this.chat.broadcastLiveState(stream.roomId);
      }
    }
  }

  /**
   * PREMIUM 1v1 (showMode = PRIVATE): lock 1v1, scala 1 minuto, kicka altri
   * viewer (via liveState). Disponibile SOLO se la streamer e' in modalita
   * PRIVATE (premium 1v1). In Pubblico/Privato-gruppo non e' attivabile.
   */
  async startPrivate(viewerId: string, streamId: string, exclusive = false) {
    const stream = await this.prisma.stream.findUnique({
      where: { id: streamId },
      select: {
        id: true,
        roomId: true,
        userId: true,
        status: true,
        showMode: true,
        privatePricePerMinute: true,
        currentPrivateViewerId: true,
        currentPrivateExclusive: true,
      },
    });
    if (!stream || stream.status !== "LIVE") {
      throw new NotFoundException("live_offline");
    }
    if (stream.userId === viewerId) {
      throw new BadRequestException("sei_la_streamer");
    }
    if (stream.showMode !== ShowMode.PRIVATE) {
      throw new BadRequestException("premium_non_attivo");
    }
    if (stream.privatePricePerMinute <= 0) {
      throw new BadRequestException("premium_non_configurato");
    }
    if (
      stream.currentPrivateViewerId &&
      stream.currentPrivateViewerId !== viewerId
    ) {
      throw new ConflictException("show_premium_in_corso");
    }

    const price = stream.privatePricePerMinute;

    const result = await this.prisma.$transaction(async (tx) => {
      // lock atomico: solo se nessuno e' attualmente in privato
      const lock = await tx.stream.updateMany({
        where: {
          id: stream.id,
          OR: [
            { currentPrivateViewerId: null },
            { currentPrivateViewerId: viewerId },
          ],
        },
        data: {
          currentPrivateViewerId: viewerId,
          currentPrivateExclusive: exclusive,
        },
      });
      if (lock.count === 0) {
        throw new ConflictException("show_premium_in_corso");
      }

      if (price > 0) {
        const priceDec = new Prisma.Decimal(price);
        const r = await tx.user.updateMany({
          where: {
            id: viewerId,
            balance: { gte: priceDec },
          },
          data: { balance: { decrement: priceDec } },
        });
        if (r.count === 0) {
          await tx.stream.update({
            where: { id: stream.id },
            data: { currentPrivateViewerId: null },
          });
          throw new HttpException(
            { message: "balance_insufficiente" },
            HttpStatus.PAYMENT_REQUIRED,
          );
        }
        const net = priceDec.mul(this.creatorNetMul());
        await tx.user.update({
          where: { id: stream.userId },
          data: { creatorBalance: { increment: net } },
        });
      }

      let access = await tx.streamAccess.findFirst({
        where: {
          streamId: stream.id,
          viewerId,
          mode: ShowMode.PRIVATE,
          endedAt: null,
        },
      });
      const isNew = !access;
      if (!access) {
        access = await tx.streamAccess.create({
          data: {
            streamId: stream.id,
            viewerId,
            mode: ShowMode.PRIVATE,
            pricePaid: price,
          },
        });
      } else {
        access = await tx.streamAccess.update({
          where: { id: access.id },
          data: { pricePaid: { increment: price } },
        });
      }
      await this.emitStreamAccessEvent(tx, {
        accessId: access.id,
        streamId: stream.id,
        creatorId: stream.userId,
        mode: ShowMode.PRIVATE,
        pricePaid: price,
        recurring: !isNew,
      });
      return access;
    });

    if (stream.roomId) {
      void this.chat.broadcastLiveState(stream.roomId);
    }
    return { access: result, exclusive };
  }

  async createPrivateRequest(
    viewerId: string,
    streamId: string,
    exclusive = false,
  ) {
    const stream = await this.prisma.stream.findUnique({
      where: { id: streamId },
      select: {
        id: true,
        roomId: true,
        userId: true,
        status: true,
        privatePricePerMinute: true,
        currentPrivateViewerId: true,
      },
    });
    if (!stream || stream.status !== "LIVE") {
      throw new NotFoundException("live_offline");
    }
    if (stream.userId === viewerId) {
      throw new BadRequestException("sei_la_streamer");
    }
    if (stream.currentPrivateViewerId) {
      throw new ConflictException("show_premium_in_corso");
    }
    if (stream.privatePricePerMinute <= 0) {
      throw new BadRequestException("premium_non_configurato");
    }

    const viewer = await this.prisma.user.findUnique({
      where: { id: viewerId },
      select: { id: true, username: true, balance: true },
    });
    if (!viewer) throw new NotFoundException("viewer_non_trovato");
    if (Number(viewer.balance) < stream.privatePricePerMinute) {
      throw new HttpException(
        { message: "balance_insufficiente" },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const existing = await this.prisma.privateRequest.findFirst({
      where: { streamId: stream.id, viewerId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      return {
        id: existing.id,
        status: existing.status,
        expiresAt: existing.expiresAt,
      };
    }

    const expiresAt = new Date(Date.now() + StreamsService.REQUEST_TTL_MS);
    const created = await this.prisma.privateRequest.create({
      data: {
        streamId: stream.id,
        viewerId,
        creatorId: stream.userId,
        tokensPerMinute: stream.privatePricePerMinute,
        kind: exclusive ? "EXCLUSIVE" : "NORMAL",
        expiresAt,
      },
    });
    if (stream.roomId) {
      this.chat.broadcastPrivateRequest(stream.roomId, {
        requestId: created.id,
        viewerId,
        viewerUsername: viewer.username,
        tokensPerMinute: created.tokensPerMinute,
        exclusive: created.kind === "EXCLUSIVE",
        expiresAt: created.expiresAt,
      });
    }
    return {
      id: created.id,
      status: created.status,
      expiresAt: created.expiresAt,
    };
  }

  async listPrivateRequestsForCreator(creatorId: string) {
    await this.expireStalePrivateRequests();
    const rows = await this.prisma.privateRequest.findMany({
      where: { creatorId, status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: {
        viewer: { select: { id: true, username: true, avatarUrl: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      streamId: r.streamId,
      tokensPerMinute: r.tokensPerMinute,
      kind: r.kind,
      exclusive: r.kind === "EXCLUSIVE",
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      viewer: r.viewer,
    }));
  }

  async acceptPrivateRequest(creatorId: string, requestId: string) {
    const req = await this.prisma.privateRequest.findUnique({
      where: { id: requestId },
      include: {
        stream: {
          select: {
            id: true,
            roomId: true,
            status: true,
            userId: true,
            currentPrivateViewerId: true,
          },
        },
      },
    });
    if (!req) throw new NotFoundException("richiesta_non_trovata");
    if (req.creatorId !== creatorId) {
      throw new ForbiddenException("non_autorizzato");
    }
    if (req.status !== "PENDING") {
      throw new ConflictException("richiesta_non_pending");
    }
    if (req.expiresAt < new Date()) {
      await this.prisma.privateRequest.update({
        where: { id: req.id },
        data: { status: "EXPIRED", respondedAt: new Date() },
      });
      throw new ConflictException("richiesta_scaduta");
    }
    if (!req.stream || req.stream.status !== "LIVE") {
      throw new ConflictException("live_offline");
    }
    if (req.stream.currentPrivateViewerId) {
      throw new ConflictException("show_premium_in_corso");
    }

    await this.prisma.$transaction([
      this.prisma.privateRequest.update({
        where: { id: req.id },
        data: { status: "ACCEPTED", respondedAt: new Date() },
      }),
      this.prisma.privateRequest.updateMany({
        where: {
          streamId: req.streamId,
          status: "PENDING",
          NOT: { id: req.id },
        },
        data: {
          status: "REJECTED",
          respondedAt: new Date(),
          rejectionReason: "altra_richiesta_accettata",
        },
      }),
      this.prisma.stream.update({
        where: { id: req.streamId },
        data: {
          showMode: ShowMode.PRIVATE,
          currentPrivateViewerId: req.viewerId,
          currentPrivateExclusive: req.kind === "EXCLUSIVE",
          privatePricePerMinute: req.tokensPerMinute,
        },
      }),
    ]);

    await this.startPrivate(
      req.viewerId,
      req.streamId,
      req.kind === "EXCLUSIVE",
    );
    if (req.stream.roomId) {
      await this.chat.broadcastLiveState(req.stream.roomId);
    }
    return {
      ok: true,
      requestId: req.id,
      streamId: req.streamId,
      viewerId: req.viewerId,
      exclusive: req.kind === "EXCLUSIVE",
    };
  }

  async rejectPrivateRequest(creatorId: string, requestId: string) {
    const r = await this.prisma.privateRequest.findUnique({
      where: { id: requestId },
    });
    if (!r) throw new NotFoundException("richiesta_non_trovata");
    if (r.creatorId !== creatorId) {
      throw new ForbiddenException("non_autorizzato");
    }
    if (r.status !== "PENDING") {
      throw new ConflictException("richiesta_non_pending");
    }
    await this.prisma.privateRequest.update({
      where: { id: requestId },
      data: { status: "REJECTED", respondedAt: new Date() },
    });
    return { ok: true, status: "REJECTED" };
  }

  private async expireStalePrivateRequests() {
    await this.prisma.privateRequest.updateMany({
      where: { status: "PENDING", expiresAt: { lt: new Date() } },
      data: { status: "EXPIRED", respondedAt: new Date() },
    });
  }

  /** Heartbeat lato viewer ogni 60s: scala un altro minuto del Premium 1v1. */
  async tickPrivate(viewerId: string, streamId: string) {
    const stream = await this.prisma.stream.findUnique({
      where: { id: streamId },
      select: {
        id: true,
        userId: true,
        roomId: true,
        showMode: true,
        privatePricePerMinute: true,
        currentPrivateViewerId: true,
      },
    });
    if (!stream) throw new NotFoundException();
    if (stream.showMode !== ShowMode.PRIVATE) {
      // la streamer ha cambiato modalita: chiudi sessione lato viewer
      throw new ForbiddenException("premium_chiuso");
    }
    if (stream.currentPrivateViewerId !== viewerId) {
      throw new ForbiddenException("non_in_premium");
    }
    const price = stream.privatePricePerMinute;

    const result = await this.prisma.$transaction(async (tx) => {
      if (price > 0) {
        const priceDec = new Prisma.Decimal(price);
        const r = await tx.user.updateMany({
          where: {
            id: viewerId,
            balance: { gte: priceDec },
          },
          data: { balance: { decrement: priceDec } },
        });
        if (r.count === 0) {
          // balance esaurito: termino la sessione automaticamente
          await tx.stream.update({
            where: { id: stream.id },
            data: { currentPrivateViewerId: null },
          });
          await tx.streamAccess.updateMany({
            where: {
              streamId: stream.id,
              viewerId,
              mode: ShowMode.PRIVATE,
              endedAt: null,
            },
            data: { endedAt: new Date() },
          });
          throw new HttpException(
            { message: "balance_insufficiente", terminated: true },
            HttpStatus.PAYMENT_REQUIRED,
          );
        }
        const net = priceDec.mul(this.creatorNetMul());
        await tx.user.update({
          where: { id: stream.userId },
          data: { creatorBalance: { increment: net } },
        });
      }
      const access = await tx.streamAccess.updateMany({
        where: {
          streamId: stream.id,
          viewerId,
          mode: ShowMode.PRIVATE,
          endedAt: null,
        },
        data: { pricePaid: { increment: price } },
      });
      return { ok: true, charged: price, accessUpdated: access.count };
    });

    return result;
  }

  async endPrivate(viewerId: string, streamId: string) {
    const stream = await this.prisma.stream.findUnique({
      where: { id: streamId },
      select: {
        id: true,
        roomId: true,
        userId: true,
        currentPrivateViewerId: true,
        currentPrivateExclusive: true,
      },
    });
    if (!stream) throw new NotFoundException();
    const isStreamer = stream.userId === viewerId;
    if (!isStreamer && stream.currentPrivateViewerId !== viewerId) {
      throw new ForbiddenException("non_in_premium");
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.stream.update({
        where: { id: stream.id },
        data: { currentPrivateViewerId: null, currentPrivateExclusive: false },
      });
      await tx.streamAccess.updateMany({
        where: {
          streamId: stream.id,
          mode: ShowMode.PRIVATE,
          endedAt: null,
        },
        data: { endedAt: new Date() },
      });
    });
    if (stream.roomId) {
      void this.chat.broadcastLiveState(stream.roomId);
    }
    return { ok: true };
  }

  async issueStreamerToken(userId: string, room: string) {
    const r = room?.trim();
    if (!r) throw new BadRequestException("room_richiesto");

    const stream = await this.prisma.stream.findFirst({
      where: {
        roomId: r,
        userId,
        status: "LIVE",
      },
    });
    if (!stream) {
      throw new ForbiddenException("stream_non_trovato");
    }

    const identity = `streamer-${userId}`;
    return this.livekit.issueStreamerToken(r, identity);
  }

  async issueViewerToken(
    viewerId: string,
    room: string,
    roomPasswordPlain?: string | null,
  ) {
    const r = room?.trim();
    if (!r) throw new BadRequestException("room_richiesto");

    const stream = await this.prisma.stream.findFirst({
      where: { roomId: r, status: "LIVE" },
      include: { user: { select: { id: true } } },
    });
    if (!stream) {
      throw new NotFoundException("live_offline");
    }
    // Password sala (link invito): obbligatoria prima degli altri controlli
    if (stream.passwordHash) {
      const attempt = roomPasswordPlain?.trim() ?? "";
      const ok =
        attempt.length >= 4 &&
        (await bcrypt.compare(attempt, stream.passwordHash));
      if (!ok) {
        throw new ForbiddenException("password_room_errata");
      }
    }

    // Premium 1v1 (showMode = PRIVATE): puo' entrare solo
    //  - il viewer in 1v1
    //  - oppure un viewer con ticket SPY attivo
    if (stream.showMode === ShowMode.PRIVATE) {
      if (stream.currentPrivateViewerId !== viewerId) {
        if (stream.currentPrivateExclusive) {
          throw new ForbiddenException("show_premium_esclusivo");
        }
        const spy = await this.prisma.streamAccess.findFirst({
          where: {
            streamId: stream.id,
            viewerId,
            mode: ShowMode.SPY,
            endedAt: null,
          },
          select: { id: true },
        });
        if (!spy) {
          throw new ForbiddenException("show_premium_in_corso");
        }
      }
    } else if (stream.showMode === ShowMode.BASE) {
      // Privato (gruppo): serve il ticket pagato
      const access = await this.prisma.streamAccess.findFirst({
        where: {
          streamId: stream.id,
          viewerId,
          mode: ShowMode.BASE,
          endedAt: null,
        },
      });
      if (!access) {
        throw new ForbiddenException("show_privato_a_pagamento");
      }
    }

    const identity = `viewer-${viewerId}`;
    return this.livekit.issueViewerToken(r, identity);
  }

  async liveMetaForCreator(creatorUserId: string) {
    const resolvedUser = await this.prisma.user.findFirst({
      where: { OR: [{ id: creatorUserId }, { username: creatorUserId }] },
      select: { id: true },
    });
    if (!resolvedUser) throw new NotFoundException();
    const realCreatorUserId = resolvedUser.id;
    const stream = await this.prisma.stream.findFirst({
      where: { userId: realCreatorUserId, status: "LIVE" },
    });
    const user = await this.prisma.user.findUnique({
      where: { id: realCreatorUserId },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        bio: true,
        tags: true,
        category: true,
        language: true,
        country: true,
        gender: true,
        isCouple: true,
        privateShowPrice: true,
      },
    });
    if (!user) throw new NotFoundException();

    let tipsTotal = 0;
    if (stream) {
      const sum = await this.prisma.tip.aggregate({
        where: { streamId: stream.id },
        _sum: { amount: true },
      });
      tipsTotal = Number(sum._sum.amount?.toString() ?? "0");
    }

    return {
      streamerId: user.id,
      isLive: !!stream,
      room: stream?.roomId ?? `live-${realCreatorUserId}`,
      name: user.username,
      tags: user.tags,
      description: user.bio ?? "",
      country: user.country,
      language: user.language,
      gender: user.gender,
      isCouple: user.isCouple,
      pricePerMinute: user.privateShowPrice
        ? Number(user.privateShowPrice.toString())
        : 0,
      thumbnail: stream?.thumbnail ?? user.avatarUrl,
      title: stream?.title ?? user.username,
      subject: stream?.title || user.username,
      showMode: stream?.showMode ?? ShowMode.PUBLIC,
      basePrice: stream?.basePrice ?? 0,
      privatePricePerMinute: stream?.privatePricePerMinute ?? 0,
      spyPricePerMinute: stream?.spyPricePerMinute ?? 0,
      chatOpen: stream?.chatOpen ?? true,
      tipsTotal,
      needsRoomPassword: !!(stream?.passwordHash),
      stream: stream
        ? {
            id: stream.id,
            room: stream.roomId,
            title: stream.title,
            viewers: stream.viewers,
            thumbnail: stream.thumbnail,
            isPrivate: stream.isPrivate,
            needsRoomPassword: !!stream.passwordHash,
            showMode: stream.showMode,
            basePrice: stream.basePrice,
            privatePricePerMinute: stream.privatePricePerMinute,
            spyPricePerMinute: stream.spyPricePerMinute,
            chatOpen: stream.chatOpen,
            currentPrivateViewerId: stream.currentPrivateViewerId,
          }
        : null,
    };
  }
}
