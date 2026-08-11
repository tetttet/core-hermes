import { constants as zlibConstants } from "node:zlib";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import * as helmetModule from "helmet";
import type { HelmetOptions } from "helmet";
import { pinoHttp } from "pino-http";
import { loadConfig } from "./config.js";
import type { AppContext } from "./context.js";
import { createDatabase } from "./db.js";
import { createCaches } from "./lib/cache.js";
import { TokenService } from "./lib/tokens.js";
import { createLogger } from "./logger.js";
import { optionalAuth } from "./middleware/auth.js";
import { authRouter } from "./routes/auth.js";
import { chatsRouter } from "./routes/chats.js";
import { chatStreamRouter } from "./routes/chat-stream.js";
import { healthRouter } from "./routes/health.js";
import { ActivityTracker } from "./services/activity-tracker.js";
import { GuestLimitStore } from "./services/guest-limits.js";

type HelmetFactory = (options?: Readonly<HelmetOptions>) => RequestHandler;

// Some deploy bundlers expose Helmet's dual ESM/CJS export as a namespace object.
const helmetNamespace = helmetModule as unknown as {
  default?: HelmetFactory;
};
const helmet = typeof helmetNamespace.default === "function"
  ? helmetNamespace.default
  : helmetModule as unknown as HelmetFactory;

export function createApp(context: AppContext) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", context.config.trustProxy ? 1 : false);

  app.use(pinoHttp({ logger: context.logger }));
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cors({
    origin(origin, callback) {
      if (!origin || context.config.clientOrigins.includes(origin)) callback(null, true);
      else callback(new Error("origin is not allowed"));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Device-Id"],
    exposedHeaders: ["RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset"],
    maxAge: 86_400,
  }));
  app.use(compression({
    threshold: 1_024,
    level: 1,
    brotli: {
      params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 4 },
    },
    filter(request, response) {
      if (request.path.endsWith("/chat/stream")) return false;
      return compression.filter(request, response);
    },
  }));
  app.use(cookieParser(context.config.cookieSecret));
  app.use(express.json({ limit: context.config.jsonBodyLimit, strict: true }));
  app.use(optionalAuth(context.tokens, context.activity));

  app.get("/", (_request, response) => {
    response.json({ service: "core-server", status: "ok" });
  });
  app.use("/health", healthRouter(context));
  app.use("/api/auth", authRouter(context));
  app.use("/api/chats", chatsRouter(context));
  app.use("/api/chat", chatStreamRouter(context));

  app.use((_request, response) => {
    response.status(404).json({ error: "Маршрут не найден" });
  });

  const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
    request.log.error({ err: error }, "request failed");
    if (response.headersSent) {
      response.end();
      return;
    }
    const status = (error as { status?: number }).status;
    response.status(status === 413 ? 413 : 500).json({
      error: status === 413 ? "Тело запроса слишком большое" : "Внутренняя ошибка сервера",
    });
  };
  app.use(errorHandler);
  return app;
}

const config = loadConfig();
const logger = createLogger(config);
const database = createDatabase(config, logger);
const activity = new ActivityTracker(database, logger);
const guestLimits = new GuestLimitStore(database, config, logger);

export const runtime: AppContext = {
  config,
  logger,
  database,
  activity,
  guestLimits,
  caches: createCaches(config),
  tokens: new TokenService(config),
};

// Fail the cold start early when the runtime database is unavailable.
await database.query({ name: "startup-ping", text: "SELECT 1" });

export default createApp(runtime);
