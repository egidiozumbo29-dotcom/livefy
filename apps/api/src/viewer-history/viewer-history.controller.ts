import { Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthedRequest } from "../common/types/request-user";
import { ViewerHistoryService } from "./viewer-history.service";

@Controller("viewer-history")
export class ViewerHistoryController {
  constructor(private readonly history: ViewerHistoryService) {}

  @Post(":creatorId")
  @UseGuards(JwtAuthGuard)
  record(
    @Req() req: AuthedRequest,
    @Param("creatorId") creatorId: string,
  ) {
    return this.history.recordVisit(req.user.userId, creatorId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list(
    @Req() req: AuthedRequest,
    @Query("take") takeRaw?: string,
  ) {
    const n = takeRaw ? Number(takeRaw) : 50;
    return this.history.listForViewer(
      req.user.userId,
      Number.isFinite(n) ? n : 50,
    );
  }
}
