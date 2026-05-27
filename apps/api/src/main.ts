import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });
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
  await app.listen(port);

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
    const header = "[livefy] Credenziali esterne mancanti:";
    // eslint-disable-next-line no-console
    console.warn("\n" + header);
    // eslint-disable-next-line no-console
    for (const m of missing) console.warn("  - " + m);
  }
}

bootstrap();
