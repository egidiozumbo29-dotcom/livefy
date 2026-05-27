import { Module } from "@nestjs/common";
import { ChatModule } from "../chat/chat.module";
import { TipsController } from "./tips.controller";
import { TipsService } from "./tips.service";

@Module({
  imports: [ChatModule],
  controllers: [TipsController],
  providers: [TipsService],
  exports: [TipsService],
})
export class TipsModule {}
