import { Router } from "express";
import type { AppContext } from "../context.js";

export function healthRouter(context: AppContext) {
  const router = Router();
  router.get("/live", (_request, response) => response.json({ status: "ok" }));
  router.get("/ready", async (_request, response) => {
    await context.database.query({ name: "health-ready", text: "SELECT 1" });
    response.json({ status: "ok" });
  });
  return router;
}
