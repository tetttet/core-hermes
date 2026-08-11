import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Logger } from "pino";
import type { AppConfig } from "../config.js";
import type { Database } from "../db.js";
import { currentWeekStart, GuestLimitStore } from "./guest-limits.js";

describe("currentWeekStart", () => {
  it("uses a UTC Monday boundary", () => {
    assert.equal(currentWeekStart(new Date("2026-08-10T18:00:00.000Z")), "2026-08-10");
    assert.equal(currentWeekStart(new Date("2026-08-16T23:59:59.000Z")), "2026-08-10");
    assert.equal(currentWeekStart(new Date("2026-08-17T00:00:00.000Z")), "2026-08-17");
  });
});

describe("GuestLimitStore", () => {
  it("coalesces a cold load and atomically caps concurrent local requests", async () => {
    let loads = 0;
    const database = {
      async query() {
        loads += 1;
        await new Promise<void>((resolve) => setImmediate(resolve));
        return { rows: [] };
      },
    } as unknown as Database;
    const config = {
      guestCacheMax: 100,
      guestLimitFlushMs: 60_000,
      guestWeeklyLimit: 5,
    } as AppConfig;
    const logger = { warn() {} } as unknown as Logger;
    const store = new GuestLimitStore(database, config, logger);
    try {
      const results = await Promise.all(
        Array.from({ length: 6 }, () => store.consume(["cookie-key", "fingerprint-key"])),
      );
      assert.equal(loads, 1);
      assert.equal(results.filter((result) => result.allowed).length, 5);
      assert.equal(results.at(-1)?.allowed, false);
    } finally {
      store.stop();
    }
  });

  it("honors the signed browser quota floor after a process restart", async () => {
    const database = {
      async query() {
        return { rows: [] };
      },
    } as unknown as Database;
    const config = {
      guestCacheMax: 100,
      guestLimitFlushMs: 60_000,
      guestWeeklyLimit: 5,
    } as AppConfig;
    const store = new GuestLimitStore(
      database,
      config,
      { warn() {} } as unknown as Logger,
    );
    try {
      const result = await store.consume(["cookie-key", "fingerprint-key"], 5);
      assert.equal(result.allowed, false);
      assert.equal(result.remaining, 0);
      assert.equal(result.used, 5);
    } finally {
      store.stop();
    }
  });
});
