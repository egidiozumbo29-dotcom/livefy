import { Module, forwardRef } from "@nestjs/common";
import { ChatModule } from "../chat/chat.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { LivekitService } from "./livekit.service";
import { StreamsController } from "./streams.controller";
import { StreamsService } from "./streams.service";

@Module({
  imports: [forwardRef(() => ChatModule), NotificationsModule],
  controllers: [StreamsController],
  providers: [StreamsService, LivekitService],
  exports: [StreamsService],
})
export class StreamsModule {}
