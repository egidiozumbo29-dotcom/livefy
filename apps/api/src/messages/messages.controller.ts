import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Req,
  UseGuards,
  Query,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthedRequest } from "../common/types/request-user";
import { SendMessageDto } from "./dto/send-message.dto";
import { MessagesService } from "./messages.service";

@Controller("messages")
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  send(@Req() req: AuthedRequest, @Body() dto: SendMessageDto) {
    return this.messages.send(req.user.userId, dto);
  }

  @Get("conversations")
  @UseGuards(JwtAuthGuard)
  conversations(@Req() req: AuthedRequest, @Query("take") take?: string) {
    const n = take ? Number(take) : 40;
    return this.messages.conversations(
      req.user.userId,
      Number.isFinite(n) ? n : 40,
    );
  }

  @Get("thread/:peerId")
  @UseGuards(JwtAuthGuard)
  thread(
    @Req() req: AuthedRequest,
    @Param("peerId") peerId: string,
    @Query("take") take?: string,
  ) {
    const n = take ? Number(take) : 40;
    return this.messages.thread(
      req.user.userId,
      peerId,
      Number.isFinite(n) ? n : 40,
    );
  }

  @Post("private-chat/:viewerId/lock")
  @UseGuards(JwtAuthGuard)
  lockPrivateChat(
    @Req() req: AuthedRequest,
    @Param("viewerId") viewerId: string,
  ) {
    return this.messages.setPrivateChatLocked(
      req.user.userId,
      req.user.role,
      viewerId,
      true,
    );
  }

  @Get("private-chat/:viewerId/status")
  @UseGuards(JwtAuthGuard)
  privateChatStatus(
    @Req() req: AuthedRequest,
    @Param("viewerId") viewerId: string,
  ) {
    return this.messages.privateChatStatus(
      req.user.userId,
      req.user.role,
      viewerId,
    );
  }

  @Post("private-chat/:viewerId/unlock")
  @UseGuards(JwtAuthGuard)
  unlockPrivateChat(
    @Req() req: AuthedRequest,
    @Param("viewerId") viewerId: string,
  ) {
    return this.messages.setPrivateChatLocked(
      req.user.userId,
      req.user.role,
      viewerId,
      false,
    );
  }
}
