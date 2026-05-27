import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Req,
  Query,
  Param,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthedRequest } from "../common/types/request-user";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: AuthedRequest) {
    return this.users.findSafeById(req.user.userId);
  }

  @Patch("me")
  @UseGuards(JwtAuthGuard)
  async patchMe(@Req() req: AuthedRequest, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(req.user.userId, dto);
  }

  @Post("me/presence")
  @UseGuards(JwtAuthGuard)
  async pingPresence(@Req() req: AuthedRequest) {
    return this.users.touchPresence(req.user.userId);
  }

  @Get("search")
  search(@Query("q") q?: string, @Query("take") take?: string) {
    const n = take ? Number(take) : 20;
    return this.users.search(q ?? "", Number.isFinite(n) ? n : 20);
  }

  @Get(":id")
  profile(@Param("id") id: string) {
    return this.users.findPublicProfile(id);
  }
}
