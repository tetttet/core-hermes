import { createServer } from "node:http";
import app, { runtime } from "./app.js";

const { activity, config, database, guestLimits, logger } = runtime;

const server = createServer(app);
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
