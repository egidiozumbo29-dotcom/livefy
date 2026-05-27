import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import type { AuthedRequest } from "../common/types/request-user";
import { CreatePayoutDto } from "./dto/create-payout.dto";
import { PayoutsService } from "./payouts.service";

@Controller("payouts")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.MODEL, Role.ADMIN)
export class PayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Get("me/status")
  status(@Req() req: AuthedRequest) {
    return this.payouts.getStatus(req.user.userId);
  }

  @Get("me")
  list(@Req() req: AuthedRequest) {
    return this.payouts.listMine(req.user.userId);
  }

  @Post()
  request(@Req() req: AuthedRequest, @Body() dto: CreatePayoutDto) {
    return this.payouts.request(req.user.userId, dto);
  }
}
