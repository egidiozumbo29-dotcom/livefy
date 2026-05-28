import { Controller, Get, Inject, Optional } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { PrismaService } from "./prisma/prisma.service";
import { RedisService } from "./redis/redis.service";

const PKG_VERSION = process.env.npm_package_version ?? "0.1.0";

@SkipThrottle()
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(RedisService) private readonly redis?: RedisService,
  ) {}

  /** Evita 404 su GET /api (browser o health check generico). */
  @Get()
  root() {
    return {
      ok: true,
      service: "synthra-api",
      version: PKG_VERSION,
      health: "/api/health",
    };
  }

  @Get("health")
  async health() {
    const checks: Record<string, "ok" | "error"> = {};
    let allOk = true;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks["db"] = "ok";
    } catch {
      checks["db"] = "error";
      allOk = false;
    }

    try {
      const redisClient = this.redis?.getClient();
      if (redisClient) {
        await redisClient.ping();
      }
      checks["redis"] = "ok";
    } catch {
      checks["redis"] = "error";
    }

    return {
      ok: allOk,
      service: "synthra-api",
      version: PKG_VERSION,
      ts: new Date().toISOString(),
      checks,
    };
  }
}
