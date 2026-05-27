import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { Prisma, Role } from "@prisma/client";
import { AuthService } from "../auth/auth.service";
import { FollowService } from "../follow/follow.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import type { UpdateProfileDto } from "./dto/update-profile.dto";
import {
  isUserOnlinePresence,
  mergedDisplayLanguages,
  normalizeSocialLinksPayload,
  ONLINE_PRESENCE_MS,
  sanitizeSocialLinksStored,
} from "./profile-social.helpers";


@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly follow: FollowService,
    private readonly notifications: NotificationsService,
  ) {}

  async findSafeById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.banned) {
      throw new NotFoundException();
    }
    return this.auth.sanitizeUser(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.banned) throw new NotFoundException();

    const data: Prisma.UserUpdateInput = {};

    if (dto.bio !== undefined) data.bio = dto.bio.trim();
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl.trim();
    if (dto.bannerUrl !== undefined) data.bannerUrl = dto.bannerUrl.trim();
    if (dto.category !== undefined) data.category = dto.category.trim();
    if (dto.language !== undefined) data.language = dto.language.trim();
    if (dto.languages !== undefined) {
      data.languages = dto.languages.map((t) => t.trim()).filter(Boolean).slice(0, 16);
    }
    if (dto.country !== undefined) data.country = dto.country.trim();
    if (dto.gender !== undefined) data.gender = dto.gender.trim();
    if (dto.isCouple !== undefined) data.isCouple = dto.isCouple;
    if (dto.tags !== undefined) {
      data.tags = dto.tags.map((t) => t.trim()).filter(Boolean).slice(0, 40);
    }
    if (dto.socialLinks !== undefined) {
      const payload = normalizeSocialLinksPayload(
        dto.socialLinks as Record<string, unknown>,
      );
      data.socialLinks = payload as unknown as Prisma.InputJsonValue;
    }

    if (dto.privateShowPrice !== undefined) {
      if (user.role !== Role.MODEL && user.role !== Role.ADMIN) {
        throw new ForbiddenException("solo_creator_price");
      }
      data.privateShowPrice = new Prisma.Decimal(dto.privateShowPrice);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
    });
    return this.auth.sanitizeUser(updated);
  }

  async touchPresence(userId: string) {
    const DEBOUNCE_MS = 45_000;
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { lastSeenAt: true, banned: true },
    });
    if (!row || row.banned) throw new NotFoundException();
    const nowMs = Date.now();
    if (row.lastSeenAt && nowMs - row.lastSeenAt.getTime() < DEBOUNCE_MS) {
      return { ok: true as const };
    }

    const wasAway =
      !row.lastSeenAt ||
      nowMs - row.lastSeenAt.getTime() > ONLINE_PRESENCE_MS;

    await this.prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() },
    });

    void this.notifications
      .maybeNotifyFollowersCreatorOnline(userId, wasAway)
      .catch(() => {
        /* best effort */
      });

    return { ok: true as const };
  }

  async search(q: string, take = 20) {
    const query = q.trim();
    if (query.length < 2) {
      return { items: [] as unknown[] };
    }

    const rows = await this.prisma.user.findMany({
      where: {
        banned: false,
        OR: [
          { username: { contains: query, mode: "insensitive" } },
          { tags: { hasSome: [query.toLowerCase()] } },
        ],
      },
      take: Math.min(take, 40),
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        category: true,
        tags: true,
        role: true,
      },
    });

    return {
      items: rows,
    };
  }

  async findPublicProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        bannerUrl: true,
        bio: true,
        category: true,
        tags: true,
        language: true,
        languages: true,
        country: true,
        role: true,
        gender: true,
        isCouple: true,
        privateShowPrice: true,
        banned: true,
        socialLinks: true,
        lastSeenAt: true,
      },
    });
    if (!user || user.banned) throw new NotFoundException();

    const [social, stream] = await Promise.all([
      this.follow.counts(user.id),
      this.prisma.stream.findFirst({
        where: { userId: user.id, status: "LIVE" },
      }),
    ]);

    const isLive = !!stream;
    const isOnline = isUserOnlinePresence(isLive, user.lastSeenAt ?? null);

    return {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      bannerUrl: user.bannerUrl,
      bio: user.bio ?? "",
      category: user.category,
      tags: user.tags,
      language: user.language,
      languages: mergedDisplayLanguages(user.language, user.languages),
      country: user.country,
      role: user.role,
      gender: user.gender,
      isCouple: user.isCouple,
      privateShowPrice: user.privateShowPrice
        ? Number(user.privateShowPrice.toString())
        : null,
      followers: social.followers,
      isLive,
      isOnline,
      socialLinks: sanitizeSocialLinksStored(user.socialLinks) ?? {},
      stream: stream
        ? {
            id: stream.id,
            room: stream.roomId,
            title: stream.title,
            viewers: stream.viewers,
            thumbnail: stream.thumbnail,
            isPrivate: stream.isPrivate,
          }
        : null,
    };
  }
}
