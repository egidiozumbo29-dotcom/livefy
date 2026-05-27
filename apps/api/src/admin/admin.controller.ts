import {
  BadRequestException,
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { PayoutStatus, Role } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import type { AuthedRequest } from "../common/types/request-user";
import { PayoutsService } from "../payouts/payouts.service";
import { PatchUserAdminDto } from "./dto/patch-user-admin.dto";
import { PatchPayoutAdminDto } from "./dto/patch-payout-admin.dto";
import { AdminService } from "./admin.service";

@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly payouts: PayoutsService,
  ) {}

  @Get("users")
  users(@Query("take") take?: string, @Query("cursor") cursor?: string) {
    const n = take ? Number(take) : 30;
    return this.admin.listUsers(Number.isFinite(n) ? n : 30, cursor);
  }

  @Patch("users/:id")
  patchUser(@Param("id") id: string, @Body() dto: PatchUserAdminDto) {
    return this.admin.patchUser(id, dto);
  }

  @Get("payouts")
  async listPayouts(
    @Req() req: AuthedRequest,
    @Query("status") status?: string,
    @Query("take") take?: string,
  ) {
    await this.admin.assertOwnerAdmin(req.user.userId);
    const t = take ? Number(take) : 50;
    let st: PayoutStatus | undefined;
    if (
      status &&
      (Object.values(PayoutStatus) as string[]).includes(status)
    ) {
      st = status as PayoutStatus;
    }
    return this.payouts.listForAdmin(st, Number.isFinite(t) ? t : 50);
  }

  @Get("finance/summary")
  async financeSummary(
    @Req() req: AuthedRequest,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    await this.admin.assertOwnerAdmin(req.user.userId);
    return this.admin.financeSummary(from, to);
  }

  @Patch("payouts/:id")
  async patchPayout(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() dto: PatchPayoutAdminDto,
  ) {
    await this.admin.assertOwnerAdmin(req.user.userId);
    if (dto.status === PayoutStatus.PENDING) {
      throw new BadRequestException("stato_non_consentito");
    }
    return this.payouts.adminSetStatus(id, dto.status);
  }

  /** Diagnostica rapida: verifica ruolo admin autenticato. */
  @Get("ping")
  ping(@Req() req: AuthedRequest) {
    return { ok: true, adminId: req.user.userId };
  }
}
