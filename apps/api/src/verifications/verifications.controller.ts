import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import type { AuthedRequest } from "../common/types/request-user";
import { CreateVerificationDto } from "./dto/create-verification.dto";
import { VerificationsService } from "./verifications.service";

@Controller("verifications")
@UseGuards(JwtAuthGuard)
export class VerificationsController {
  constructor(private readonly verifications: VerificationsService) {}

  @Post()
  async create(@Req() req: AuthedRequest, @Body() dto: CreateVerificationDto) {
    return this.verifications.create(req.user.userId, dto);
  }

  @Get("me")
  async getMyStatus(@Req() req: AuthedRequest) {
    return this.verifications.getMyStatus(req.user.userId);
  }

  @Get("pending")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async listPending() {
    return this.verifications.listPending();
  }

  @Post(":id/approve")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async approve(@Param("id") id: string, @Req() req: AuthedRequest) {
    return this.verifications.approve(id, req.user.userId);
  }

  @Post(":id/reject")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async reject(@Param("id") id: string, @Body() body: { reason: string }) {
    return this.verifications.reject(id, body.reason);
  }
}
