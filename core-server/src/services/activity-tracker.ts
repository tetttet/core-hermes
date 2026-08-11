import type { Logger } from "pino";
import type { Database } from "../db.js";

export class ActivityTracker {
  readonly #pending = new Set<string>();
  readonly #timer: NodeJS.Timeout;

  constructor(
    private readonly database: Database,
    private readonly logger: Logger,
  ) {
    this.#timer = setInterval(() => void this.flush(), 60_000);
    this.#timer.unref();
  }

  touch(userId: string) {
    this.#pending.add(userId);
  }

  async flush() {
    if (this.#pending.size === 0) return;
    const userIds = [...this.#pending];
    this.#pending.clear();
    try {
      await this.database.query({
        name: "users-touch-active",
        text: "UPDATE users SET last_active_at = now() WHERE id = ANY($1::uuid[])",
        values: [userIds],
      });
    } catch (error) {
      for (const userId of userIds) this.#pending.add(userId);
      this.logger.warn({ err: error }, "could not flush user activity");
    }
  }

  stop() {
    clearInterval(this.#timer);
  }
}
