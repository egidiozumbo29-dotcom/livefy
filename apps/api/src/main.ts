import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { JsonLogger } from "./logger/json.logger";

const isProd = process.env.NODE_ENV === "production";
const logger = new Logger("Bootstrap");

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    bufferLogs: true,
    logger: isProd ? new JsonLogger() : undefined,
  });

  app.enableShutdownHooks();

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

  const origins = process.env.CORS_ORIGIN?.split(",").map((s) => s.trim()).filter(Boolean);
  app.enableCors({
    origin: origins?.length ? origins : true,
    credentials: true,
  });

  app.setGlobalPrefix("api");

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = process.env.PORT ?? "4000";
  await app.listen(port, "0.0.0.0");
  logger.log(`Synthra API in ascolto sulla porta ${port}`);

  const missing: string[] = [];
  if (!process.env.LIVEKIT_URL || !process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
    missing.push("LiveKit (LIVEKIT_URL/API_KEY/API_SECRET) -> dirette video disabilitate");
  }
  if (!process.env.REVOLUT_API_KEY) {
    missing.push("Revolut (REVOLUT_API_KEY) -> checkout pacchetti token disabilitato");
  }
  if (!process.env.REDIS_URL) {
    missing.push("Redis (REDIS_URL) -> cache disabilitata (OK in dev)");
  }
  if (missing.length) {
    logger.warn("Credenziali esterne mancanti:");
    for (const m of missing) logger.warn(`  - ${m}`);
  }

  const shutdown = async (signal: string) => {
    logger.log(`Ricevuto ${signal} — graceful shutdown...`);
    await app.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => { void shutdown("SIGTERM"); });
  process.on("SIGINT", () => { void shutdown("SIGINT"); });
}

bootstrap();
