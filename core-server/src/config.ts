import "dotenv/config";

export type AppConfig = ReturnType<typeof loadConfig>;

function integer(name: string, fallback: number, minimum = 0) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < minimum) {
    throw new Error(`${name} must be an integer >= ${minimum}`);
  }
  return value;
}

function required(name: string, minimumLength = 1) {
  const value = process.env[name]?.trim();
  if (!value || value.length < minimumLength) {
    throw new Error(`${name} is required and must contain at least ${minimumLength} characters`);
  }
  return value;
}

function optional(name: string) {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function boolean(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  throw new Error(`${name} must be a boolean`);
}

function durationMs(name: string, value: string) {
  const match = /^(\d+)(s|m|h|d)$/.exec(value);
  if (!match) throw new Error(`${name} must use a duration such as 15m, 2h, or 1d`);
  const amount = Number.parseInt(match[1]!, 10);
  const multiplier = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]!];
  return amount * multiplier!;
}

export function loadConfig() {
  const nodeEnv = process.env.NODE_ENV || "development";
  const databaseUrl = required("DATABASE_URL");
  const accessTokenTtl = process.env.ACCESS_TOKEN_TTL || "15m";
  if (nodeEnv === "production" && !databaseUrl.includes("-pooler.")) {
    throw new Error("DATABASE_URL must use the Neon pooled (-pooler) endpoint in production");
  }

  return {
    nodeEnv,
    isProduction: nodeEnv === "production",
    port: integer("PORT", 4000, 1),
    host: process.env.HOST || "0.0.0.0",
    databaseUrl,
    openRouterApiKey: required("OPENROUTER_API_KEY"),
    appUrl: process.env.APP_URL || "http://localhost:3000",
    clientOrigins: (process.env.CLIENT_ORIGINS || "http://localhost:3000")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    jwtAccessSecret: required("JWT_ACCESS_SECRET", 32),
    jwtIssuer: process.env.JWT_ISSUER || "core-server",
    jwtAudience: process.env.JWT_AUDIENCE || "core-client",
    accessTokenTtl,
    accessTokenCookieTtlMs: durationMs("ACCESS_TOKEN_TTL", accessTokenTtl),
    refreshTokenTtlDays: integer("REFRESH_TOKEN_TTL_DAYS", 30, 1),
    cookieSecret: required("COOKIE_SECRET", 32),
    fingerprintSecret: required("FINGERPRINT_SECRET", 32),
    cookieDomain: optional("COOKIE_DOMAIN"),
    trustProxy: boolean("TRUST_PROXY", nodeEnv === "production"),
    dbPoolMax: integer("DB_POOL_MAX", 10, 1),
    dbIdleTimeoutMs: integer("DB_IDLE_TIMEOUT_MS", 30_000, 1_000),
    dbConnectTimeoutMs: integer("DB_CONNECT_TIMEOUT_MS", 8_000, 1_000),
    guestWeeklyLimit: integer("GUEST_WEEKLY_LIMIT", 5, 1),
    guestLimitFlushMs: integer("GUEST_LIMIT_FLUSH_MS", 5_000, 1_000),
    profileCacheMax: integer("CACHE_PROFILE_MAX", 10_000, 100),
    profileCacheTtlMs: integer("CACHE_PROFILE_TTL_MS", 300_000, 1_000),
    chatsCacheMax: integer("CACHE_CHATS_MAX", 10_000, 100),
    chatsCacheTtlMs: integer("CACHE_CHATS_TTL_MS", 30_000, 1_000),
    guestCacheMax: integer("CACHE_GUEST_MAX", 100_000, 1_000),
    jsonBodyLimit: process.env.JSON_BODY_LIMIT || "18mb",
    firstTokenTimeoutMs: integer("OPENROUTER_FIRST_TOKEN_TIMEOUT_MS", 180_000, 1_000),
    idleTimeoutMs: integer("OPENROUTER_IDLE_TIMEOUT_MS", 180_000, 1_000),
    overallTimeoutMs: integer("OPENROUTER_OVERALL_TIMEOUT_MS", 290_000, 1_000),
    logLevel: process.env.LOG_LEVEL || (nodeEnv === "production" ? "info" : "debug"),
  };
}
