import type { CookieOptions, Request } from "express";
import type { AppConfig } from "../config.js";

type CookieTransportOptions = Pick<CookieOptions, "domain" | "sameSite" | "secure">;

function requestUsesHttps(request: Request, config: AppConfig) {
  const forwardedProtocol = request.get("x-forwarded-proto")
    ?.split(",", 1)[0]
    ?.trim()
    .toLowerCase();
  return config.isProduction || request.secure || forwardedProtocol === "https";
}

function compatibleCookieDomain(request: Request, configuredDomain?: string) {
  const normalizedDomain = configuredDomain?.trim().replace(/^\./, "").toLowerCase();
  if (!normalizedDomain || normalizedDomain === "localhost") return undefined;

  const hostname = request.hostname.toLowerCase();
  return hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`)
    ? configuredDomain
    : undefined;
}

export function cookieTransportOptions(
  request: Request,
  config: AppConfig,
): CookieTransportOptions {
  const secure = requestUsesHttps(request, config);
  const domain = compatibleCookieDomain(request, config.cookieDomain);
  return {
    secure,
    sameSite: secure ? "none" : "lax",
    ...(domain ? { domain } : {}),
  };
}
