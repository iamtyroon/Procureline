import { Injectable, OnApplicationShutdown, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import type { AppConfig } from "@/common/config/app-config";

@Injectable()
export class RedisProbeService implements OnModuleInit, OnApplicationShutdown {
  private readonly redis: Redis;

  constructor(configService: ConfigService<AppConfig, true>) {
    this.redis = new Redis(configService.get("redisUrl", { infer: true }), {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.redis.connect();
    } catch {
      // Redis may be unavailable at startup — isAvailable() will report degraded status.
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      return (await this.redis.ping()) === "PONG";
    } catch {
      return false;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.redis.status !== "end") {
      await this.redis.quit().catch(() => undefined);
    }
  }
}
