import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Request } from "express";
import type { AppConfig } from "../config.js";
import { cookieTransportOptions } from "./cookie-options.js";

function request(hostname: string, forwardedProtocol?: string) {
  return {
    hostname,
    secure: false,
    get(name: string) {
      return name.toLowerCase() === "x-forwarded-proto" ? forwardedProtocol : undefined;
    },
  } as Request;
}

function config(overrides: Partial<AppConfig> = {}) {
  return {
    isProduction: false,
    cookieDomain: undefined,
    ...overrides,
  } as AppConfig;
}

describe("cookieTransportOptions", () => {
  it("creates cross-site-compatible cookies behind an HTTPS proxy", () => {
    assert.deepEqual(
      cookieTransportOptions(
        request("core-hermes.vercel.app", "https"),
        config({ cookieDomain: "localhost" }),
      ),
      { secure: true, sameSite: "none" },
    );
  });

  it("keeps local HTTP cookies lax and host-only", () => {
    assert.deepEqual(
      cookieTransportOptions(request("localhost"), config({ cookieDomain: "localhost" })),
      { secure: false, sameSite: "lax" },
    );
  });

  it("allows a configured parent domain only for a matching request host", () => {
    assert.deepEqual(
      cookieTransportOptions(
        request("api.example.com", "https"),
        config({ cookieDomain: ".example.com" }),
      ),
      { secure: true, sameSite: "none", domain: ".example.com" },
    );
    assert.deepEqual(
      cookieTransportOptions(
        request("core-hermes.vercel.app", "https"),
        config({ cookieDomain: ".example.com" }),
      ),
      { secure: true, sameSite: "none" },
    );
  });
});
