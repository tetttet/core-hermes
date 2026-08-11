import { createServer } from "node:http";
import { createApp } from "./app.js";
import { createCaches } from "./lib/cache.js";
import { loadConfig } from "./config.js";
import { createDatabase } from "./db.js";
import { createLogger } from "./logger.js";
import { TokenService } from "./lib/tokens.js";
import { ActivityTracker } from "./services/activity-tracker.js";
import { GuestLimitStore } from "./services/guest-limits.js";

const config = loadConfig();
const logger = createLogger(config);
const database = createDatabase(config, logger);
const activity = new ActivityTracker(database, logger);
const guestLimits = new GuestLimitStore(database, config, logger);
const context = {
  config,
  logger,
  database,
  activity,
  guestLimits,
  caches: createCaches(config),
  tokens: new TokenService(config),
};

// Pay the Neon/TCP cold connection cost before accepting user traffic.
await database.query({ name: "startup-ping", text: "SELECT 1" });

const server = createServer(createApp(context));
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
server.requestTimeout = 310_000;
server.listen(config.port, config.host, () => {
  logger.info({ host: config.host, port: config.port }, "core-server listening");
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "graceful shutdown started");
  server.closeIdleConnections();
  const forceTimer = setTimeout(() => server.closeAllConnections(), 10_000);
  forceTimer.unref();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  clearTimeout(forceTimer);
  activity.stop();
  guestLimits.stop();
  await Promise.allSettled([activity.flush(), guestLimits.flush()]);
  await database.end();
  logger.info("graceful shutdown complete");
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
