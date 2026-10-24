import { Module } from "@nestjs/common";
import { VerificationsController } from "./verifications.controller";
import { VerificationsService } from "./verifications.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [VerificationsController],
  providers: [VerificationsService],
  exports: [VerificationsService],
})
export class VerificationsModule {}
