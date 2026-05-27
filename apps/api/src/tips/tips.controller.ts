import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthedRequest } from "../common/types/request-user";
import { CreateTipDto } from "./dto/create-tip.dto";
import { TipsService } from "./tips.service";

@Controller("tips")
export class TipsController {
  constructor(private readonly tips: TipsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  send(@Req() req: AuthedRequest, @Body() dto: CreateTipDto) {
    return this.tips.sendTip(req.user.userId, dto);
  }

  @Get("feed/:receiverId")
  feed(@Param("receiverId") receiverId: string) {
    return this.tips.tipFeed(receiverId);
  }

  @Get("leaderboard/:streamId")
  leaderboard(
    @Param("streamId") streamId: string,
    @Query("take") take?: string,
  ) {
    const t = take ? Number(take) : 10;
    return this.tips.tipLeaderboardForStream(streamId, Number.isFinite(t) ? t : 10);
  }
}
