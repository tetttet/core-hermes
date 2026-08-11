import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ActivityTracker } from "../services/activity-tracker.js";
import type { TokenService } from "../lib/tokens.js";

function accessToken(request: Request) {
  const authorization = request.get("authorization");
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7);
  const cookie = request.cookies.access_token as unknown;
  return typeof cookie === "string" ? cookie : undefined;
}

export function optionalAuth(
  tokens: TokenService,
  activity: ActivityTracker,
): RequestHandler {
  return async (request, _response, next) => {
    const token = accessToken(request);
    if (!token) {
      next();
      return;
    }
    try {
      request.auth = await tokens.verifyAccessToken(token);
      activity.touch(request.auth.id);
    } catch {
      delete request.auth;
    }
    next();
  };
}

export function requireAuth(request: Request, response: Response, next: NextFunction) {
  if (!request.auth) {
    response.status(401).json({ error: "Требуется авторизация" });
    return;
  }
  next();
}
