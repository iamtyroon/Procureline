import { ConsoleLogger, Injectable, LoggerService } from "@nestjs/common";
import { requestContextStorage } from "@/common/logging/request-context";

@Injectable()
export class AppLogger extends ConsoleLogger implements LoggerService {
  override log(message: unknown, context?: string): void {
    super.log(this.formatLogMessage("log", message, context));
  }

  override error(message: unknown, trace?: string, context?: string): void {
    super.error(this.formatLogMessage("error", message, context), trace);
  }

  override warn(message: unknown, context?: string): void {
    super.warn(this.formatLogMessage("warn", message, context));
  }

  override debug(message: unknown, context?: string): void {
    super.debug(this.formatLogMessage("debug", message, context));
  }

  override verbose(message: unknown, context?: string): void {
    super.verbose(this.formatLogMessage("verbose", message, context));
  }

  private formatLogMessage(level: string, message: unknown, context?: string): string {
    return JSON.stringify({
      context,
      correlationId: requestContextStorage.getCorrelationId(),
      level,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
