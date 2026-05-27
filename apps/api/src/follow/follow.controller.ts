import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthedRequest } from "../common/types/request-user";
import { FollowService } from "./follow.service";

@Controller("follow")
export class FollowController {
  constructor(private readonly follow: FollowService) {}

  @Get("me/following")
  @UseGuards(JwtAuthGuard)
  myFollowing(@Req() req: AuthedRequest) {
    return this.follow.listFollowing(req.user.userId);
  }

  @Post(":followingId")
  @UseGuards(JwtAuthGuard)
  followUser(
    @Req() req: AuthedRequest,
    @Param("followingId") followingId: string,
  ) {
    return this.follow.follow(req.user.userId, followingId);
  }

  @Delete(":followingId")
  @UseGuards(JwtAuthGuard)
  unfollow(
    @Req() req: AuthedRequest,
    @Param("followingId") followingId: string,
  ) {
    return this.follow.unfollow(req.user.userId, followingId);
  }

  @Get("counts/:userId")
  counts(@Param("userId") userId: string) {
    return this.follow.counts(userId);
  }

  @Get("status/:followingId")
  @UseGuards(JwtAuthGuard)
  status(
    @Req() req: AuthedRequest,
    @Param("followingId") followingId: string,
  ) {
    return this.follow.isFollowing(req.user.userId, followingId);
  }
}
