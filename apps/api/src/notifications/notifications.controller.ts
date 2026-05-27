import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthedRequest } from "../common/types/request-user";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async list(
    @Req() req: AuthedRequest,
    @Query("take") takeRaw?: string,
  ) {
    const n = takeRaw ? Number(takeRaw) : 40;
    return this.notifications.listForUser(
      req.user.userId,
      Number.isFinite(n) ? n : 40,
    );
  }

  @Patch("read-all")
  async readAll(@Req() req: AuthedRequest) {
    return this.notifications.markAllRead(req.user.userId);
  }

  @Patch(":id/read")
  async readOne(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
  ) {
    return this.notifications.markOneRead(req.user.userId, id);
  }
}
