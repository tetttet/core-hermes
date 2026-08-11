import pg from "pg";
import type { Logger } from "pino";
import type { AppConfig } from "./config.js";

const { Pool } = pg;

export function createDatabase(config: AppConfig, logger: Logger) {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: config.dbPoolMax,
    idleTimeoutMillis: config.dbIdleTimeoutMs,
    connectionTimeoutMillis: config.dbConnectTimeoutMs,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    allowExitOnIdle: false,
  });

  pool.on("error", (error) => {
    logger.error({ err: error }, "unexpected idle PostgreSQL connection error");
  });

  return pool;
}

export type Database = ReturnType<typeof createDatabase>;
