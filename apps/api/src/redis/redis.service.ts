import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url = this.config.get<string>("REDIS_URL");
    if (!url) {
      this.logger.warn("REDIS_URL non impostato — caching disabilitata.");
      return;
    }
    try {
      this.client = new Redis(url, { maxRetriesPerRequest: 3 });
    } catch (e) {
      this.logger.error("Impossibile connettersi a Redis", e as Error);
    }
  }

  async onModuleDestroy() {
    if (this.client) await this.client.quit();
  }

  getClient(): Redis | null {
    return this.client;
  }
}
