import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { OutboxService } from "../outbox/outbox.service";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { JwtPayload } from "./strategies/jwt.strategy";
import { sanitizeSocialLinksStored } from "../users/profile-social.helpers";

function yearsBetween(from: Date, to: Date): number {
  let age = to.getFullYear() - from.getFullYear();
  const m = to.getMonth() - from.getMonth();
  if (m < 0 || (m === 0 && to.getDate() < from.getDate())) age--;
  return age;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly outbox: OutboxService,
  ) {}

  async register(dto: RegisterDto) {
    const birth = new Date(dto.birthDate);
    if (Number.isNaN(birth.getTime())) {
      throw new BadRequestException("birthDate_non_valida");
    }
    if (yearsBetween(birth, new Date()) < 18) {
      throw new BadRequestException("eta_non_consentita");
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    try {
      const user = await this.prisma.user.create({
        data: {
          username: dto.username.trim(),
          email: dto.email.trim().toLowerCase(),
          passwordHash,
          birthDate: birth,
          ageVerified: true,
          country: dto.country?.trim(),
          language: dto.language?.trim() ?? "it",
          role: Role.VIEWER,
          lastSeenAt: new Date(),
        },
      });

      await this.outbox.write(this.prisma, {
        type: "USER_SIGNUP",
        externalId: `signup_${user.id}`,
        occurredAt: user.createdAt,
        userId: user.id,
        username: user.username,
        meta: { role: user.role, country: user.country, language: user.language },
      });

      const token = this.signUser(user.id, user.role);
      return {
        access_token: token,
        user: this.sanitizeUser(user),
      };
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === "P2002") {
        throw new BadRequestException("email_o_username_esistente");
      }
      throw e;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    if (!user) {
      throw new UnauthorizedException("credenziali_non_valide");
    }
    if (user.banned) {
      throw new UnauthorizedException("account_bloccato");
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException("credenziali_non_valide");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    });

    const token = this.signUser(user.id, user.role);
    return {
      access_token: token,
      user: this.sanitizeUser(user),
    };
  }

  /** Token + user aggiornati dopo cambio ruolo (es. verifica streamer). */
  async getAuthBundleForUserId(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    return {
      access_token: this.signUser(user.id, user.role),
      user: this.sanitizeUser(user),
    };
  }

  private signUser(sub: string, role: Role) {
    const payload: JwtPayload = { sub, role };
    return this.jwt.sign(payload);
  }

  sanitizeUser(user: {
    id: string;
    username: string;
    email: string;
    role: Role;
    balance: { toString(): string };
    creatorBalance: { toString(): string };
    avatarUrl: string | null;
    bannerUrl: string | null;
    bio: string | null;
    language: string | null;
    languages?: string[];
    socialLinks?: unknown;
    country: string | null;
    category: string | null;
    tags: string[];
    ageVerified: boolean;
    createdAt: Date;
  }) {
    const socialLinks = sanitizeSocialLinksStored(user.socialLinks) ?? {};

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      balance: Number(user.balance.toString()),
      creatorBalance: Number(user.creatorBalance.toString()),
      avatarUrl: user.avatarUrl,
      bannerUrl: user.bannerUrl,
      bio: user.bio ?? "",
      language: user.language,
      languages: user.languages ?? [],
      socialLinks,
      country: user.country,
      category: user.category,
      tags: user.tags,
      ageVerified: user.ageVerified,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
