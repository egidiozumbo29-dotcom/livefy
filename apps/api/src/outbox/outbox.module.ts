import { Global, Module } from "@nestjs/common";
import { OutboxService } from "./outbox.service";
import { OutboxFlusher } from "./outbox.flusher";

@Global()
@Module({
  providers: [OutboxService, OutboxFlusher],
  exports: [OutboxService],
})
export class OutboxModule {}
