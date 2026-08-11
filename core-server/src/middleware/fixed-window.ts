import type { RequestHandler } from "express";
import { LRUCache } from "lru-cache";

type Options = {
  maximum: number;
  windowMs: number;
  key?: (ip: string, path: string) => string;
};

export function fixedWindowLimit({ maximum, windowMs, key }: Options): RequestHandler {
  const counters = new LRUCache<string, { count: number; reset: number }>({
    max: 50_000,
    ttl: windowMs,
  });

  return (request, response, next) => {
    const now = Date.now();
    const ip = request.ip || request.socket.remoteAddress || "unknown";
    const id = key?.(ip, request.path) ?? `${ip}:${request.path}`;
    const current = counters.get(id);
    const state = !current || current.reset <= now
      ? { count: 1, reset: now + windowMs }
      : { count: current.count + 1, reset: current.reset };
    counters.set(id, state, { ttl: Math.max(1, state.reset - now) });
    if (state.count > maximum) {
      response.setHeader("Retry-After", String(Math.ceil((state.reset - now) / 1_000)));
      response.status(429).json({ error: "Слишком много попыток. Попробуйте позже." });
      return;
    }
    next();
  };
}
