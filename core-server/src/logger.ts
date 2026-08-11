import pino from "pino";
import type { AppConfig } from "./config.js";

export function createLogger(config: AppConfig) {
  return pino(
    {
      level: config.logLevel,
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "password",
          "passwordHash",
          "token",
        ],
        censor: "[redacted]",
      },
    },
    pino.destination({ dest: 1, sync: false }),
  );
}
