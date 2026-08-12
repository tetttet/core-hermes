import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { loadConfig } from "../config.js";

const originalEnv = { ...process.env };

function configure(nodeEnv: "development" | "production") {
  process.env.NODE_ENV = nodeEnv;
  process.env.DATABASE_URL = nodeEnv === "production"
    ? "postgres://user:password@ep-test-pooler.example.com/database"
    : "postgres://user:password@localhost/database";
  process.env.OPENROUTER_API_KEY = "test-key";
  process.env.JWT_ACCESS_SECRET = "a".repeat(32);
  process.env.COOKIE_SECRET = "b".repeat(32);
  process.env.FINGERPRINT_SECRET = "c".repeat(32);
  process.env.APP_URL = "http://localhost:3000, https://hermeees.vercel.app";
  process.env.CLIENT_ORIGINS = "http://localhost:3000, https://hermeees.vercel.app";
}

describe("loadConfig URL lists", () => {
  before(() => {
    configure("development");
  });

  after(() => {
    process.env = originalEnv;
  });

  it("parses comma-separated client origins", () => {
    const config = loadConfig();
    assert.deepEqual(config.clientOrigins, [
      "http://localhost:3000",
      "https://hermeees.vercel.app",
    ]);
  });

  it("uses the local APP_URL in development", () => {
    assert.equal(loadConfig().appUrl, "http://localhost:3000");
  });

  it("uses the deployed APP_URL in production", () => {
    configure("production");
    assert.equal(loadConfig().appUrl, "https://hermeees.vercel.app");
  });
});
