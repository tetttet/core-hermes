import type { AppConfig } from "./config.js";
import type { Database } from "./db.js";
import type { Caches } from "./lib/cache.js";
import type { TokenService } from "./lib/tokens.js";
import type { Logger } from "pino";
import type { ActivityTracker } from "./services/activity-tracker.js";
import type { GuestLimitStore } from "./services/guest-limits.js";

export type AppContext = {
  config: AppConfig;
  database: Database;
  logger: Logger;
  caches: Caches;
  tokens: TokenService;
  activity: ActivityTracker;
  guestLimits: GuestLimitStore;
};
