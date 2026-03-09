import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { URL } from "node:url";
import type { AppConfig } from "@/common/config/app-config";
import { PLATFORM_QUEUE } from "@/queue/queue.constants";
import { QueueService } from "@/queue/queue.service";
import { RedisProbeService } from "@/queue/redis-probe.service";

export function buildRedisConnection(configService: ConfigService<AppConfig, true>) {
  const redisUrl = configService.get("redisUrl", { infer: true });
  const parsed = new URL(redisUrl);
  const database = parsed.pathname.replace(/^\//, "");
  const db = database.length > 0 ? Number(database) : undefined;

  return {
    ...(Number.isFinite(db) ? { db } : {}),
    host: parsed.hostname,
    password: parsed.password || undefined,
    port: parsed.port ? Number(parsed.port) : 6379,
    ...(parsed.protocol === "rediss:" ? { tls: {} } : {}),
    username: parsed.username || undefined,
  };
}

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => ({
        connection: buildRedisConnection(configService),
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            delay: 1_000,
            type: "exponential",
          },
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      }),
  }),
    BullModule.registerQueue({
      name: PLATFORM_QUEUE,
    }),
  ],
  providers: [QueueService, RedisProbeService],
  exports: [BullModule, QueueService, RedisProbeService],
})
export class QueueModule {}
