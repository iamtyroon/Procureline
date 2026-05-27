const { spawn, spawnSync } = require("node:child_process");

const serviceUrl = process.env.NESTJS_INTERNAL_URL || "http://nestjs:4001";
const tunnelUrlPattern = /https:\/\/[-a-z0-9]+\.trycloudflare\.com/i;
let registeredUrl = null;

function registerTunnelUrl(url) {
  if (registeredUrl === url) {
    return;
  }

  const result = spawnSync(
    "npx",
    ["convex", "env", "--env-file", ".env.docker.local", "set", "NESTJS_URL", url],
    { cwd: "/workspace/webapp", encoding: "utf8", stdio: "inherit" },
  );

  if (result.status !== 0) {
    console.error("Failed to register the temporary NestJS tunnel URL in Convex.");
    process.exit(result.status || 1);
  }

  registeredUrl = url;
  console.log(`Registered Convex NESTJS_URL=${url}`);
  console.log("This developer now owns shared Nest-backed workflows until another tunnel is registered.");
}

const tunnel = spawn(
  "cloudflared",
  ["tunnel", "--no-autoupdate", "--url", serviceUrl],
  { stdio: ["ignore", "pipe", "pipe"] },
);

function handleOutput(data) {
  const message = data.toString();
  process.stdout.write(message);
  const match = message.match(tunnelUrlPattern);
  if (match) {
    registerTunnelUrl(match[0]);
  }
}

tunnel.stdout.on("data", handleOutput);
tunnel.stderr.on("data", handleOutput);
tunnel.on("exit", (code) => {
  console.error(`Temporary NestJS tunnel exited with code ${code ?? "unknown"}.`);
  process.exit(code || 1);
});

function shutdown() {
  tunnel.kill("SIGTERM");
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
