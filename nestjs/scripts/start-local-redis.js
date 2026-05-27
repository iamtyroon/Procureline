const { RedisMemoryServer } = require("redis-memory-server");

const redis = new RedisMemoryServer({
  instance: {
    ip: "127.0.0.1",
    port: 6379,
  },
});

async function shutdown(signal) {
  await redis.stop();
  process.exit(signal ? 0 : 1);
}

async function start() {
  const host = await redis.getHost();
  const port = await redis.getPort();
  console.log(`Local Redis listening on redis://${host}:${port}`);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("uncaughtException", (error) => {
  console.error(error);
  void shutdown();
});
process.on("unhandledRejection", (error) => {
  console.error(error);
  void shutdown();
});

void start();
