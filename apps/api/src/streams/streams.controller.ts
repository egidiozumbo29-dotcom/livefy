import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import type { AuthedRequest } from "../common/types/request-user";
import { PrivateRequestDto, PrivateStartDto, StreamIdDto } from "./dto/access.dto";
import { StartStreamDto } from "./dto/start-stream.dto";
import { UpdateLiveDto } from "./dto/update-live.dto";
import { ViewerTokenDto } from "./dto/viewer-token.dto";
import { StreamsService } from "./streams.service";

@Controller("streams")
export class StreamsController {
  constructor(private readonly streams: StreamsService) {}

  @Get("live")
  listLive() {
    return this.streams.listLive();
  }

  /** Meta pubblica per pagina watch (compatibilità con viewer legacy). */
  @Get("public/:creatorId/meta")
  meta(@Param("creatorId") creatorId: string) {
    return this.streams.liveMetaForCreator(creatorId);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODEL, Role.ADMIN)
  getMine(@Req() req: AuthedRequest) {
    return this.streams.getMyLive(req.user.userId);
  }

  @Patch("me")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODEL, Role.ADMIN)
  updateMine(@Req() req: AuthedRequest, @Body() dto: UpdateLiveDto) {
    return this.streams.updateMyLive(req.user.userId, dto);
  }

  @Post("start")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODEL, Role.ADMIN)
  start(@Req() req: AuthedRequest, @Body() dto: StartStreamDto) {
    return this.streams.startLive(req.user.userId, dto);
  }

  @Post("ingress/obs")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODEL, Role.ADMIN)
  createObsIngress(@Req() req: AuthedRequest) {
    return this.streams.createObsIngress(req.user.userId);
  }

  @Delete("ingress/obs")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODEL, Role.ADMIN)
  removeObsIngress(@Req() req: AuthedRequest) {
    return this.streams.removeObsIngress(req.user.userId);
  }

  @Post("stop")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODEL, Role.ADMIN)
  stop(@Req() req: AuthedRequest) {
    return this.streams.stopLive(req.user.userId);
  }

  @Get("token/streamer")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODEL, Role.ADMIN)
  streamerToken(@Req() req: AuthedRequest, @Query("room") room: string) {
    return this.streams.issueStreamerToken(req.user.userId, room ?? "");
  }

  @Get("token/viewer")
  @UseGuards(JwtAuthGuard)
  viewerToken(
    @Req() req: AuthedRequest,
    @Query("room") room: string,
    @Query("roomPassword") roomPassword?: string,
  ) {
    return this.streams.issueViewerToken(
      req.user.userId,
      room ?? "",
      roomPassword,
    );
  }

  @Post("token/viewer")
  @UseGuards(JwtAuthGuard)
  viewerTokenBody(@Req() req: AuthedRequest, @Body() dto: ViewerTokenDto) {
    return this.streams.issueViewerToken(
      req.user.userId,
      dto.room,
      dto.roomPassword,
    );
  }

  // ---------- show access (BASE + PRIVATE) ----------

  @Get("access/me/:creatorId")
  @UseGuards(JwtAuthGuard)
  myAccess(@Req() req: AuthedRequest, @Param("creatorId") creatorId: string) {
    return this.streams.getMyAccess(req.user.userId, creatorId);
  }

  @Post("access/base")
  @UseGuards(JwtAuthGuard)
  buyBase(@Req() req: AuthedRequest, @Body() dto: StreamIdDto) {
    return this.streams.buyBaseAccess(req.user.userId, dto.streamId);
  }

  @Post("private/start")
  @UseGuards(JwtAuthGuard)
  privateStart(@Req() req: AuthedRequest, @Body() dto: PrivateStartDto) {
    return this.streams.startPrivate(
      req.user.userId,
      dto.streamId,
      dto.exclusive,
    );
  }

  @Post("private/request")
  @UseGuards(JwtAuthGuard)
  privateRequest(@Req() req: AuthedRequest, @Body() dto: PrivateRequestDto) {
    return this.streams.createPrivateRequest(
      req.user.userId,
      dto.streamId,
      dto.exclusive,
    );
  }

  @Get("private/requests")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODEL, Role.ADMIN)
  privateRequests(@Req() req: AuthedRequest) {
    return this.streams.listPrivateRequestsForCreator(req.user.userId);
  }

  @Post("private/requests/:requestId/accept")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODEL, Role.ADMIN)
  acceptPrivateRequest(
    @Req() req: AuthedRequest,
    @Param("requestId") requestId: string,
  ) {
    return this.streams.acceptPrivateRequest(req.user.userId, requestId);
  }

  @Post("private/requests/:requestId/reject")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODEL, Role.ADMIN)
  rejectPrivateRequest(
    @Req() req: AuthedRequest,
    @Param("requestId") requestId: string,
  ) {
    return this.streams.rejectPrivateRequest(req.user.userId, requestId);
  }

  @Post("private/tick")
  @UseGuards(JwtAuthGuard)
  privateTick(@Req() req: AuthedRequest, @Body() dto: StreamIdDto) {
    return this.streams.tickPrivate(req.user.userId, dto.streamId);
  }

  @Post("private/end")
  @UseGuards(JwtAuthGuard)
  privateEnd(@Req() req: AuthedRequest, @Body() dto: StreamIdDto) {
    return this.streams.endPrivate(req.user.userId, dto.streamId);
  }

  // ---------- spy show ----------

  @Post("spy/start")
  @UseGuards(JwtAuthGuard)
  spyStart(@Req() req: AuthedRequest, @Body() dto: StreamIdDto) {
    return this.streams.startSpy(req.user.userId, dto.streamId);
  }

  @Post("spy/tick")
  @UseGuards(JwtAuthGuard)
  spyTick(@Req() req: AuthedRequest, @Body() dto: StreamIdDto) {
    return this.streams.tickSpy(req.user.userId, dto.streamId);
  }

  @Post("spy/end")
  @UseGuards(JwtAuthGuard)
  spyEnd(@Req() req: AuthedRequest, @Body() dto: StreamIdDto) {
    return this.streams.endSpy(req.user.userId, dto.streamId);
  }
}
