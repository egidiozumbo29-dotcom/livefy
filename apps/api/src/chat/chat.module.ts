import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ModerationModule } from "../moderation/moderation.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ChatGateway } from "./chat.gateway";

@Module({
  imports: [ModerationModule, PrismaModule, AuthModule],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class ChatModule {}
