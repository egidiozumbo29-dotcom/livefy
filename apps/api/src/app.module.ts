import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { ChatModule } from "./chat/chat.module";
import { HealthController } from "./health.controller";
import { PaymentsModule } from "./payments/payments.module";
import { TipsModule } from "./tips/tips.module";
import { StreamsModule } from "./streams/streams.module";
import { FollowModule } from "./follow/follow.module";
import { MessagesModule } from "./messages/messages.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { CreatorsModule } from "./creators/creators.module";
import { AdminModule } from "./admin/admin.module";
import { PayoutsModule } from "./payouts/payouts.module";
import { VerificationModule } from "./verification/verification.module";
import { VerificationsModule } from "./verifications/verifications.module";
import { ViewerHistoryModule } from "./viewer-history/viewer-history.module";
import { DiscoveryModule } from "./discovery/discovery.module";
import { ModerationModule } from "./moderation/moderation.module";
import { OutboxModule } from "./outbox/outbox.module";
import { MailerModule } from "./mailer/mailer.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    PrismaModule,
    RedisModule,
    OutboxModule,
    MailerModule,
    AuthModule,
    UsersModule,
    ChatModule,
    PaymentsModule,
    TipsModule,
    StreamsModule,
    FollowModule,
    NotificationsModule,
    ViewerHistoryModule,
    MessagesModule,
    CreatorsModule,
    AdminModule,
    PayoutsModule,
    VerificationModule,
    VerificationsModule,
    DiscoveryModule,
    ModerationModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
