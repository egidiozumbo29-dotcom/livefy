import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { OptionalJwtAuthGuard } from "../common/guards/optional-jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import type { RequestWithOptionalViewer } from "../common/guards/optional-jwt-auth.guard";
import type { AuthedRequest } from "../common/types/request-user";
import { ReplaceGalleryDto } from "./dto/replace-gallery.dto";
import { ReplaceTipMenuDto } from "./dto/replace-tip-menu.dto";
import { CreatorsService } from "./creators.service";

@Controller("creators")
export class CreatorsController {
  constructor(private readonly creators: CreatorsService) {}

  @Put("me/tip-menu")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODEL, Role.ADMIN)
  replaceMenu(@Req() req: AuthedRequest, @Body() dto: ReplaceTipMenuDto) {
    return this.creators.replaceTipMenu(req.user.userId, dto);
  }

  @Get("me/analytics")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODEL, Role.ADMIN)
  analytics(@Req() req: AuthedRequest) {
    return this.creators.analytics(req.user.userId);
  }

  @Get("me/gallery")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODEL, Role.ADMIN)
  myGallery(@Req() req: AuthedRequest) {
    return this.creators.myGallery(req.user.userId);
  }

  @Put("me/gallery")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODEL, Role.ADMIN)
  replaceGallery(@Req() req: AuthedRequest, @Body() dto: ReplaceGalleryDto) {
    return this.creators.replaceGallery(req.user.userId, dto);
  }

  @Post("gallery-items/:itemId/purchase")
  @UseGuards(JwtAuthGuard)
  purchaseItem(@Req() req: AuthedRequest, @Param("itemId") itemId: string) {
    return this.creators.purchaseGalleryItem(req.user.userId, itemId);
  }

  @Get("menu/:userId")
  getMenu(@Param("userId") userId: string) {
    return this.creators.tipMenu(userId);
  }

  @Get("gallery/:creatorId")
  @UseGuards(OptionalJwtAuthGuard)
  publicGallery(
    @Param("creatorId") creatorId: string,
    @Req() req: RequestWithOptionalViewer,
  ) {
    const viewerId = req.viewer?.userId ?? null;
    return this.creators.publicGallery(creatorId, viewerId);
  }
}
