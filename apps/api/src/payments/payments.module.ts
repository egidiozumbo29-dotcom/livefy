import { Module } from "@nestjs/common";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { WalletController } from "../wallet/wallet.controller";

@Module({
  controllers: [PaymentsController, WalletController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
