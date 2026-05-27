import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { ExtractJwt } from "passport-jwt";
import type { JwtPayload } from "../../auth/strategies/jwt.strategy";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedUser } from "../types/request-user";

/** Richiesta HTTP con viewer opzionale (Bearer valido → profilo caricato dal DB). */
export type RequestWithOptionalViewer = Request & {
  viewer?: AuthenticatedUser;
};

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithOptionalViewer>();
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    if (!token) return true;
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, role: true, banned: true },
      });
      if (user && !user.banned) {
        req.viewer = { userId: user.id, role: user.role };
      }
    } catch {
      /* token invalido → accesso pubblico anonimo */
    }
    return true;
  }
}
