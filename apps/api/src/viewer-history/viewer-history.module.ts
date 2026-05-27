import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ViewerHistoryController } from "./viewer-history.controller";
import { ViewerHistoryService } from "./viewer-history.service";

@Module({
  imports: [PrismaModule],
  controllers: [ViewerHistoryController],
  providers: [ViewerHistoryService],
})
export class ViewerHistoryModule {}
