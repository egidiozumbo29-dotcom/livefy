import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ModerationActionType, Role } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import type { AuthedRequest } from "../common/types/request-user";
import {
  AddModeratorDto,
  AddWordFilterDto,
  CreateReportDto,
  ModerateUserDto,
  PatchReportDto,
  StreamControlDto,
} from "./dto/moderation.dto";
import { ModerationService } from "./moderation.service";

@Controller("moderation")
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Get("me")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODEL, Role.ADMIN, Role.MODERATOR)
  dashboard(@Req() req: AuthedRequest) {
    return this.moderation.dashboard(req.user.userId, req.user.role);
  }

  @Post("moderators")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODEL, Role.ADMIN)
  addModerator(@Req() req: AuthedRequest, @Body() dto: AddModeratorDto) {
    return this.moderation.addModerator(req.user.userId, req.user.role, dto);
  }

  @Delete("moderators/:moderatorId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODEL, Role.ADMIN)
  removeModerator(
    @Req() req: AuthedRequest,
    @Param("moderatorId") moderatorId: string,
  ) {
    return this.moderation.removeModerator(
      req.user.userId,
      req.user.role,
      moderatorId,
    );
  }

  @Post("words")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODEL, Role.ADMIN, Role.MODERATOR)
  addWord(@Req() req: AuthedRequest, @Body() dto: AddWordFilterDto) {
    return this.moderation.addWord(req.user.userId, req.user.role, dto);
  }

  @Delete("words/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODEL, Role.ADMIN, Role.MODERATOR)
  removeWord(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.moderation.removeWord(req.user.userId, req.user.role, id);
  }

  @Post("users/:targetId/mute")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODEL, Role.ADMIN, Role.MODERATOR)
  muteUser(
    @Req() req: AuthedRequest,
    @Param("targetId") targetId: string,
    @Body() dto: ModerateUserDto,
  ) {
    return this.moderation.moderateUser(
      req.user.userId,
      req.user.role,
      targetId,
      ModerationActionType.MUTE,
      dto,
    );
  }

  @Post("users/:targetId/ban")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODEL, Role.ADMIN, Role.MODERATOR)
  banUser(
    @Req() req: AuthedRequest,
    @Param("targetId") targetId: string,
    @Body() dto: ModerateUserDto,
  ) {
    return this.moderation.moderateUser(
      req.user.userId,
      req.user.role,
      targetId,
      ModerationActionType.BAN,
      dto,
    );
  }

  @Delete("actions/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODEL, Role.ADMIN, Role.MODERATOR)
  revokeAction(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.moderation.revokeAction(req.user.userId, req.user.role, id);
  }

  @Post("reports")
  @UseGuards(JwtAuthGuard)
  createReport(@Req() req: AuthedRequest, @Body() dto: CreateReportDto) {
    return this.moderation.createReport(req.user.userId, dto);
  }

  @Get("reports")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODEL, Role.ADMIN, Role.MODERATOR)
  listReports(@Req() req: AuthedRequest) {
    return this.moderation.listReports(req.user.userId, req.user.role);
  }

  @Patch("reports/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODEL, Role.ADMIN, Role.MODERATOR)
  patchReport(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() dto: PatchReportDto,
  ) {
    return this.moderation.patchReport(req.user.userId, req.user.role, id, dto);
  }

  @Post("streams/:streamId/control")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODEL, Role.ADMIN, Role.MODERATOR)
  controlStream(
    @Req() req: AuthedRequest,
    @Param("streamId") streamId: string,
    @Body() dto: StreamControlDto,
  ) {
    return this.moderation.controlStream(
      req.user.userId,
      req.user.role,
      streamId,
      dto,
    );
  }
}
