import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthedRequest } from "../common/types/request-user";
import { PaymentsService } from "../payments/payments.service";

@Controller("wallet")
export class WalletController {
  constructor(private readonly payments: PaymentsService) {}

  @Get("transactions")
  @UseGuards(JwtAuthGuard)
  transactions(@Req() req: AuthedRequest, @Query("take") take?: string) {
    const n = take ? Number(take) : 50;
    return this.payments.listTransactions(
      req.user.userId,
      Number.isFinite(n) ? n : 50,
    );
  }
}
