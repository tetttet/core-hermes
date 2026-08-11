import { constants as zlibConstants } from "node:zlib";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import type { AppContext } from "./context.js";
import { optionalAuth } from "./middleware/auth.js";
import { authRouter } from "./routes/auth.js";
import { chatsRouter } from "./routes/chats.js";
import { chatStreamRouter } from "./routes/chat-stream.js";
import { healthRouter } from "./routes/health.js";

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
