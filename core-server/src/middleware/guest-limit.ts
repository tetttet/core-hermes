import type { Request, RequestHandler, Response } from "express";
import type { AppContext } from "../context.js";
import { cookieTransportOptions } from "../lib/cookie-options.js";
import { guestIdentity } from "../lib/fingerprint.js";
import { currentWeekStart } from "../services/guest-limits.js";

const QUOTA_COOKIE = "core_guest_quota";
const QUOTA_COOKIE_MS = 8 * 86_400_000;

function quotaFloor(value: unknown, cookieId: string, limit: number) {
  if (typeof value !== "string") return 0;
  const [boundCookieId, weekStart, rawCount] = value.split(":");
  const count = Number.parseInt(rawCount || "", 10);
  return boundCookieId === cookieId &&
    weekStart === currentWeekStart() &&
    Number.isInteger(count) &&
    count >= 0 &&
    count <= 32_767 && limit <= 32_767
    ? count
    : 0;
}

function setQuotaCookie(
  context: AppContext,
  request: Request,
  response: Response,
  cookieId: string,
  weekStart: string,
  used: number,
) {
  response.cookie(QUOTA_COOKIE, `${cookieId}:${weekStart}:${used}`, {
    httpOnly: true,
    signed: true,
    maxAge: QUOTA_COOKIE_MS,
    path: "/",
    ...cookieTransportOptions(request, context.config),
  });
}

export function guestLimit(context: AppContext): RequestHandler {
  return async (request, response, next) => {
    if (request.auth) {
      next();
      return;
    }
    try {
      const identity = guestIdentity(request, response, context.config);
      const minimumCount = quotaFloor(
        request.signedCookies[QUOTA_COOKIE],
        identity.cookieId,
        context.config.guestWeeklyLimit,
      );
      const result = await context.guestLimits.consume(identity.keys, minimumCount);
      setQuotaCookie(
        context,
        request,
        response,
        identity.cookieId,
        result.weekStart,
        result.used,
      );
      response.setHeader("RateLimit-Limit", String(result.limit));
      response.setHeader("RateLimit-Remaining", String(result.remaining));
      response.setHeader(
        "RateLimit-Reset",
        String(Math.floor(Date.parse(result.resetAt) / 1_000)),
      );
      if (!result.allowed) {
        response.status(429).json({
          error: `Гостевой лимит — ${result.limit} запросов в неделю. Зарегистрируйтесь для безлимитного доступа.`,
          code: "GUEST_WEEKLY_LIMIT",
          resetAt: result.resetAt,
        });
        return;
      }
      next();
    } catch (error) {
      context.logger.error({ err: error }, "guest limit check failed");
      response.status(503).json({ error: "Сервис лимитов временно недоступен" });
    }
  };
}
