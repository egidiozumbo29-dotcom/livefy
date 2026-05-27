import { Controller, Get } from "@nestjs/common";

@Controller()
export class HealthController {
  /** Evita 404 su GET /api (browser o health check generico). */
  @Get()
  root() {
    return {
      ok: true,
      service: "synthra-api",
      health: "/api/health",
    };
  }

  @Get("health")
  health() {
    return { ok: true, service: "synthra-api", ts: new Date().toISOString() };
  }
}
