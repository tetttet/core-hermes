import { createHmac, randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import type { AppConfig } from "../config.js";
import { cookieTransportOptions } from "./cookie-options.js";
import { isUuid } from "./validation.js";

const GUEST_COOKIE = "core_guest";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1_000;

function digest(secret: string, prefix: "c" | "f", value: string) {
  return `${prefix}_${createHmac("sha256", secret).update(value).digest("hex")}`;
}

function networkPrefix(ip: string) {
  const ipv4 = ip.replace(/^::ffff:/, "");
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ipv4)) {
    return ipv4.split(".").slice(0, 3).join(".");
  }
  return ip.toLowerCase().split(":").slice(0, 4).join(":");
}

export function guestIdentity(
  request: Request,
  response: Response,
  config: AppConfig,
) {
  const signedValue = request.signedCookies[GUEST_COOKIE] as unknown;
  const cookieId = isUuid(signedValue) ? signedValue : randomUUID();

  if (!isUuid(signedValue)) {
    const options = {
      httpOnly: true,
      signed: true,
      maxAge: ONE_YEAR_MS,
      path: "/",
      ...cookieTransportOptions(request, config),
    };
    response.cookie(GUEST_COOKIE, cookieId, options);
  }

  const rawDeviceId = request.get("x-device-id");
  const deviceMaterial = [
    isUuid(rawDeviceId) ? rawDeviceId : "unknown-device",
    networkPrefix(request.ip || request.socket.remoteAddress || "unknown"),
    request.get("user-agent") || "unknown",
    request.get("accept-language") || "unknown",
    request.get("sec-ch-ua") || "unknown",
    request.get("sec-ch-ua-platform") || "unknown",
  ].join("|");

  return {
    cookieId,
    keys: [
      digest(config.fingerprintSecret, "c", cookieId),
      digest(config.fingerprintSecret, "f", deviceMaterial),
    ] as const,
  };
}
