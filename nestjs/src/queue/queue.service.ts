import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { Queue } from "bullmq";
import { PLATFORM_QUEUE } from "@/queue/queue.constants";
import { RedisProbeService } from "@/queue/redis-probe.service";

interface QueueJobOptions {
  delay?: number;
  jobId?: string;
  priority?: number;
}

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue(PLATFORM_QUEUE) private readonly queue: Queue,
    private readonly redisProbeService: RedisProbeService,
  ) {}

  async enqueue<TPayload>(name: string, payload: TPayload, options?: QueueJobOptions): Promise<{ id: string | undefined }> {
    if (!(await this.redisProbeService.isAvailable())) {
      throw new ServiceUnavailableException({
        error: {
          code: "QUEUE_UNAVAILABLE",
          message: "Redis is unavailable. Retryable work was not accepted.",
        },
      });
    }

    const job = await this.queue.add(name, payload, {
      delay: options?.delay,
      jobId: options?.jobId,
      priority: options?.priority,
    });

    return { id: job.id?.toString() };
  }

  async remove(jobId: string): Promise<{ removed: boolean }> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      return { removed: false };
    }

    await job.remove();
    return { removed: true };
  }
}
