import { Controller, Get, UseGuards } from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "@/common/config/app-config";
import { RedisProbeService } from "@/queue/redis-probe.service";

@Controller()
export class HealthController {
  constructor(
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly redisProbeService: RedisProbeService,
  ) {}

  @Get("health")
  @UseGuards(ThrottlerGuard)
  @Throttle({ operations: { limit: 30, ttl: 60_000 } })
  async getHealth(): Promise<Record<string, unknown>> {
    return {
      service: "procureline-nestjs-services",
      status: "ok",
      dependencies: {
        redis: (await this.redisProbeService.isAvailable()) ? "up" : "degraded",
      },
      version: "0.1.0",
    };
  }

  @Get("metrics")
  @UseGuards(ThrottlerGuard)
  @Throttle({ operations: { limit: 15, ttl: 60_000 } })
  getMetrics(): Record<string, unknown> {
    return {
      service: "procureline-nestjs-services",
      swaggerEnabled: this.configService.get("swaggerEnabled", { infer: true }),
      timestamp: new Date().toISOString(),
    };
  }
}
