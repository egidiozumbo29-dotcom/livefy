import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ModerationActionType,
  Prisma,
  ReportStatus,
  Role,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type {
  AddModeratorDto,
  AddWordFilterDto,
  CreateReportDto,
  ModerateUserDto,
  PatchReportDto,
  StreamControlDto,
} from "./dto/moderation.dto";

/** Hook per keyword filter / AI esterno (Sightengine, AWS Rekognition, ecc.). */
@Injectable()
export class ModerationService {
  private readonly keywords = ["mailto:", "bit.ly/", "discord.gg/"];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Chat live pubblica/privata: più stretta degli DM (lunghezza, link, ripetizioni).
   * @param maxLen default 500 (allinea al client); DM usano ancora scanPublicChat pura.
   */
  async scanLiveChatForRoom(
    roomId: string,
    userId: string,
    text: string,
    maxLen = 500,
  ): Promise<{ ok: boolean; reason?: string }> {
    const base = this.scanLiveChat(text, maxLen);
    if (!base.ok) return base;

    const stream = await this.prisma.stream.findUnique({
      where: { roomId },
      select: { userId: true },
    });
    if (!stream) return base;

    const active = await this.activeAction(stream.userId, userId);
    if (active?.type === ModerationActionType.BAN) {
      return { ok: false, reason: "utente_bannato" };
    }
    if (active?.type === ModerationActionType.MUTE) {
      return { ok: false, reason: "utente_mutato" };
    }

    const filters = await this.prisma.wordFilter.findMany({
      where: { creatorId: stream.userId },
      select: { phrase: true },
    });
    const lower = (text ?? "").toLowerCase();
    if (filters.some((f) => lower.includes(f.phrase.toLowerCase()))) {
      return { ok: false, reason: "parola_filtrata" };
    }

    return base;
  }

  scanLiveChat(
    text: string,
    maxLen = 500,
  ): { ok: boolean; reason?: string } {
    const t = text ?? "";
    if (t.length > maxLen) {
      return { ok: false, reason: "messaggio_troppo_lungo" };
    }
    return this.scanPublicChatInner(t.toLowerCase(), t);
  }

  /** Messaggi inbox (testo lungo consentito come prima). */
  scanPublicChat(text: string): { ok: boolean; reason?: string } {
    const t = text ?? "";
    if (t.length > 2000) {
      return { ok: false, reason: "messaggio_troppo_lungo" };
    }
    return this.scanPublicChatInner(t.toLowerCase(), t);
  }

  private scanPublicChatInner(
    lower: string,
    original: string,
  ): { ok: boolean; reason?: string } {
    if (this.keywords.some((k) => lower.includes(k))) {
      return { ok: false, reason: "contenuto_sospetto" };
    }
    const urlChunks = lower.match(/https?:\/\//g);
    if (urlChunks && urlChunks.length > 4) {
      return { ok: false, reason: "troppi_link" };
    }
    // Spam visivo ripetuto (aaaaaaaa… o 😀😀😀…)
    if (/([\s\S])\1{15,}/u.test(original)) {
      return { ok: false, reason: "spam_ripetitivo" };
    }
    return { ok: true };
  }

  async dashboard(actorId: string, role: Role) {
    const creatorId = await this.resolveCreatorId(actorId, role);
    const [moderators, words, actions, reports, live] = await Promise.all([
      this.prisma.creatorModerator.findMany({
        where: { creatorId },
        orderBy: { createdAt: "desc" },
        include: {
          moderator: {
            select: { id: true, username: true, email: true, role: true },
          },
        },
      }),
      this.prisma.wordFilter.findMany({
        where: { creatorId },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.moderationAction.findMany({
        where: { creatorId, revokedAt: null },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          target: { select: { id: true, username: true, email: true } },
          actor: { select: { id: true, username: true } },
        },
      }),
      this.reportsForCreator(creatorId),
      this.prisma.stream.findFirst({
        where: { userId: creatorId, status: "LIVE" },
        select: {
          id: true,
          title: true,
          roomId: true,
          viewers: true,
          chatOpen: true,
          showMode: true,
          startedAt: true,
        },
      }),
    ]);

    return {
      creatorId,
      live: live
        ? {
            ...live,
            startedAt: live.startedAt?.toISOString() ?? null,
          }
        : null,
      moderators: moderators.map((m) => ({
        id: m.id,
        createdAt: m.createdAt.toISOString(),
        user: m.moderator,
      })),
      wordFilters: words.map((w) => ({
        id: w.id,
        phrase: w.phrase,
        createdAt: w.createdAt.toISOString(),
      })),
      actions: actions.map((a) => ({
        id: a.id,
        type: a.type,
        reason: a.reason,
        createdAt: a.createdAt.toISOString(),
        expiresAt: a.expiresAt?.toISOString() ?? null,
        target: a.target,
        actor: a.actor,
      })),
      reports,
    };
  }

  async addModerator(actorId: string, role: Role, dto: AddModeratorDto) {
    const creatorId = await this.resolveCreatorId(actorId, role, {
      ownerOnly: true,
    });
    const username = dto.username.trim();
    if (!username) throw new BadRequestException("username_richiesto");
    const moderator = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true, role: true },
    });
    if (!moderator) throw new NotFoundException("utente_non_trovato");
    if (moderator.id === creatorId) {
      throw new BadRequestException("creator_non_puo_essere_moderatore");
    }
    return this.prisma.$transaction(async (tx) => {
      if (moderator.role === Role.VIEWER) {
        await tx.user.update({
          where: { id: moderator.id },
          data: { role: Role.MODERATOR },
        });
      }
      return tx.creatorModerator.upsert({
        where: {
          creatorId_moderatorId: { creatorId, moderatorId: moderator.id },
        },
        update: {},
        create: { creatorId, moderatorId: moderator.id },
        include: {
          moderator: {
            select: { id: true, username: true, email: true, role: true },
          },
        },
      });
    });
  }

  async removeModerator(actorId: string, role: Role, moderatorId: string) {
    const creatorId = await this.resolveCreatorId(actorId, role, {
      ownerOnly: true,
    });
    await this.prisma.creatorModerator.deleteMany({
      where: { creatorId, moderatorId },
    });
    return { ok: true };
  }

  async addWord(actorId: string, role: Role, dto: AddWordFilterDto) {
    const creatorId = await this.resolveCreatorId(actorId, role);
    const phrase = dto.phrase.trim().toLowerCase();
    if (phrase.length < 2) throw new BadRequestException("parola_troppo_corta");
    return this.prisma.wordFilter.upsert({
      where: { creatorId_phrase: { creatorId, phrase } },
      update: {},
      create: { creatorId, phrase },
    });
  }

  async removeWord(actorId: string, role: Role, id: string) {
    const creatorId = await this.resolveCreatorId(actorId, role);
    await this.prisma.wordFilter.deleteMany({ where: { id, creatorId } });
    return { ok: true };
  }

  async moderateUser(
    actorId: string,
    role: Role,
    targetId: string,
    type: ModerationActionType,
    dto: ModerateUserDto,
  ) {
    const creatorId = await this.resolveCreatorId(actorId, role);
    if (targetId === creatorId) throw new BadRequestException("target_non_valido");
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, role: true },
    });
    if (!target) throw new NotFoundException("utente_non_trovato");
    if (target.role === Role.ADMIN) {
      throw new ForbiddenException("admin_non_moderabile");
    }

    const expiresAt =
      type === ModerationActionType.MUTE
        ? new Date(Date.now() + (dto.durationMinutes ?? 10) * 60_000)
        : null;

    await this.prisma.moderationAction.updateMany({
      where: { creatorId, targetId, type, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return this.prisma.moderationAction.create({
      data: {
        creatorId,
        targetId,
        actorId,
        type,
        expiresAt,
        reason: dto.reason?.trim() || null,
      },
    });
  }

  async revokeAction(actorId: string, role: Role, actionId: string) {
    const creatorId = await this.resolveCreatorId(actorId, role);
    await this.prisma.moderationAction.updateMany({
      where: { id: actionId, creatorId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async createReport(reporterId: string, dto: CreateReportDto) {
    if (!dto.targetUserId && !dto.streamId) {
      throw new BadRequestException("target_o_stream_richiesto");
    }
    return this.prisma.userReport.create({
      data: {
        reporterId,
        targetUserId: dto.targetUserId ?? null,
        streamId: dto.streamId ?? null,
        reason: dto.reason.trim().slice(0, 80),
        details: dto.details?.trim() ? dto.details.trim().slice(0, 2000) : null,
      },
    });
  }

  async listReports(actorId: string, role: Role) {
    const creatorId = await this.resolveCreatorId(actorId, role);
    return this.reportsForCreator(creatorId);
  }

  async patchReport(actorId: string, role: Role, id: string, dto: PatchReportDto) {
    const creatorId = await this.resolveCreatorId(actorId, role);
    const report = await this.prisma.userReport.findUnique({
      where: { id },
      select: { id: true, stream: { select: { userId: true } }, targetUserId: true },
    });
    if (!report) throw new NotFoundException();
    if (role !== Role.ADMIN && report.stream?.userId !== creatorId) {
      throw new ForbiddenException("report_non_accessibile");
    }
    return this.prisma.userReport.update({
      where: { id },
      data: {
        status: dto.status as ReportStatus,
        resolvedAt:
          dto.status === "RESOLVED" || dto.status === "REJECTED"
            ? new Date()
            : null,
      },
    });
  }

  async controlStream(
    actorId: string,
    role: Role,
    streamId: string,
    dto: StreamControlDto,
  ) {
    const stream = await this.prisma.stream.findUnique({
      where: { id: streamId },
      select: { id: true, userId: true },
    });
    if (!stream) throw new NotFoundException("live_non_trovata");
    await this.assertCanModerateCreator(actorId, role, stream.userId);

    if (dto.action === "END_STREAM") {
      await this.prisma.stream.update({
        where: { id: streamId },
        data: { status: "ENDED", endedAt: new Date() },
      });
      return { ok: true };
    }

    await this.prisma.stream.update({
      where: { id: streamId },
      data: { chatOpen: dto.action === "OPEN_CHAT" },
    });
    return { ok: true };
  }

  private async activeAction(creatorId: string, targetId: string) {
    return this.prisma.moderationAction.findFirst({
      where: {
        creatorId,
        targetId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: "desc" },
    });
  }

  private async resolveCreatorId(
    actorId: string,
    role: Role,
    opts: { ownerOnly?: boolean } = {},
  ) {
    if (role === Role.ADMIN) return actorId;
    if (role === Role.MODEL) return actorId;
    if (role === Role.MODERATOR && !opts.ownerOnly) {
      const first = await this.prisma.creatorModerator.findFirst({
        where: { moderatorId: actorId },
        orderBy: { createdAt: "desc" },
      });
      if (first) return first.creatorId;
    }
    throw new ForbiddenException("moderazione_non_consentita");
  }

  private async assertCanModerateCreator(
    actorId: string,
    role: Role,
    creatorId: string,
  ) {
    if (role === Role.ADMIN || actorId === creatorId) return;
    const mod = await this.prisma.creatorModerator.findUnique({
      where: { creatorId_moderatorId: { creatorId, moderatorId: actorId } },
    });
    if (!mod) throw new ForbiddenException("moderazione_non_consentita");
  }

  private async reportsForCreator(creatorId: string) {
    const rows = await this.prisma.userReport.findMany({
      where: {
        OR: [
          { stream: { userId: creatorId } },
          { targetUserId: creatorId },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        reporter: { select: { id: true, username: true } },
        target: { select: { id: true, username: true } },
        stream: { select: { id: true, title: true, status: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      reason: r.reason,
      details: r.details,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
      reporter: r.reporter,
      target: r.target,
      stream: r.stream,
    }));
  }
}
