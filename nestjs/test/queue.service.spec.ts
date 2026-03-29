import { QueueService } from "@/queue/queue.service";
import { buildRedisConnection } from "@/queue/queue.module";

describe("QueueService", () => {
  it("fails fast when Redis is unavailable", async () => {
    const queueService = new QueueService(
      {
        add: jest.fn(),
      } as never,
      {
        isAvailable: jest.fn().mockResolvedValue(false),
      } as never,
    );

    await expect(queueService.enqueue("email.send", { hello: "world" })).rejects.toMatchObject({
      response: {
        error: {
          code: "QUEUE_UNAVAILABLE",
        },
      },
    });
  });

  it("enqueues jobs when Redis is available", async () => {
    const add = jest.fn().mockResolvedValue({ id: "job-1" });
    const queueService = new QueueService(
      {
        add,
      } as never,
      {
        isAvailable: jest.fn().mockResolvedValue(true),
      } as never,
    );

    await expect(queueService.enqueue("email.send", { hello: "world" })).resolves.toEqual({
      id: "job-1",
    });
    expect(add).toHaveBeenCalledWith(
      "email.send",
      { hello: "world" },
      expect.objectContaining({}),
    );
  });

  it("passes delayed scheduling options through to BullMQ", async () => {
    const add = jest.fn().mockResolvedValue({ id: "job-2" });
    const queueService = new QueueService(
      {
        add,
      } as never,
      {
        isAvailable: jest.fn().mockResolvedValue(true),
      } as never,
    );

    await queueService.enqueue("email.send", { hello: "later" }, {
      delay: 60_000,
      jobId: "job-2",
    });

    expect(add).toHaveBeenCalledWith(
      "email.send",
      { hello: "later" },
      expect.objectContaining({
        delay: 60_000,
        jobId: "job-2",
      }),
    );
  });

  it("removes queued jobs when a matching job id exists", async () => {
    const remove = jest.fn().mockResolvedValue(undefined);
    const queueService = new QueueService(
      {
        getJob: jest.fn().mockResolvedValue({ remove }),
      } as never,
      {
        isAvailable: jest.fn().mockResolvedValue(true),
      } as never,
    );

    await expect(queueService.remove("job-1")).resolves.toEqual({ removed: true });
    expect(remove).toHaveBeenCalled();
  });

  it("preserves TLS and database settings when REDIS_URL uses rediss", () => {
    const connection = buildRedisConnection({
      get: jest.fn().mockReturnValue("rediss://user:pass@redis.example.com:6380/2"),
    } as never);

    expect(connection).toEqual(
      expect.objectContaining({
        db: 2,
        host: "redis.example.com",
        password: "pass",
        port: 6380,
        tls: {},
        username: "user",
      }),
    );
  });
});
