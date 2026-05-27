import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { StreamsModule } from "../streams/streams.module";
import { DiscoveryController } from "./discovery.controller";
import { DiscoveryService } from "./discovery.service";

@Module({
  imports: [PrismaModule, StreamsModule],
  controllers: [DiscoveryController],
  providers: [DiscoveryService],
})
export class DiscoveryModule {}
