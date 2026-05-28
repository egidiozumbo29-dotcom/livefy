import { LoggerService, LogLevel } from "@nestjs/common";

/**
 * Logger JSON strutturato per produzione.
 * Ogni riga è un JSON valido: { ts, level, context, message, ...extra }
 */
export class JsonLogger implements LoggerService {
  private write(level: string, message: unknown, context?: string) {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      context: context ?? "App",
      message: typeof message === "string" ? message : JSON.stringify(message),
    });
    if (level === "error" || level === "warn") {
      process.stderr.write(line + "\n");
    } else {
      process.stdout.write(line + "\n");
    }
  }

  log(message: unknown, context?: string) {
    this.write("info", message, context);
  }
  error(message: unknown, _trace?: string, context?: string) {
    this.write("error", message, context);
  }
  warn(message: unknown, context?: string) {
    this.write("warn", message, context);
  }
  debug(message: unknown, context?: string) {
    this.write("debug", message, context);
  }
  verbose(message: unknown, context?: string) {
    this.write("verbose", message, context);
  }
  setLogLevels?(_levels: LogLevel[]) {
    // no-op: gestiamo i livelli via NODE_ENV
  }
}
