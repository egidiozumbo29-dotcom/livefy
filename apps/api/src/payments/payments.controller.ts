import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthedRequest } from "../common/types/request-user";
import { CheckoutDto } from "./dto/checkout.dto";
import { CryptoIntentDto } from "./dto/crypto-intent.dto";
import { PaymentsService } from "./payments.service";

@Controller("payments")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get("token-packs")
  tokenPacks() {
    return this.payments.tokenPacks();
  }

  @Post("checkout-session")
  @UseGuards(JwtAuthGuard)
  async checkout(@Req() req: AuthedRequest, @Body() dto: CheckoutDto) {
    return this.payments.createCheckoutSession(req.user.userId, dto.packKey);
  }

  @Post("crypto-intent")
  @UseGuards(JwtAuthGuard)
  async cryptoIntent(@Req() req: AuthedRequest, @Body() dto: CryptoIntentDto) {
    return this.payments.createCryptoIntent(
      req.user.userId,
      dto.packKey,
      dto.network,
    );
  }

  @SkipThrottle()
  @Post("webhook")
  async webhook(@Req() req: Request & { rawBody?: Buffer }) {
    const raw = req.rawBody;
    if (!Buffer.isBuffer(raw)) {
      throw new BadRequestException("raw_body_richiesto");
    }
    const payload = JSON.parse(raw.toString("utf8")) as unknown;
    await this.payments.handleRevolutWebhook(payload);
    return { received: true };
  }
}
