import { Module } from "@nestjs/common";
import { PayoutsModule } from "../payouts/payouts.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

@Module({
  imports: [PayoutsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
