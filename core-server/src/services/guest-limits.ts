import { LRUCache } from "lru-cache";
import type { Logger } from "pino";
import type { AppConfig } from "../config.js";
import type { Database } from "../db.js";

type State = { count: number; weekStart: string };
type Dirty = { delta: number; weekStart: string };

export type GuestLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: string;
  weekStart: string;
  used: number;
};

export function currentWeekStart(now = new Date()) {
  const mondayOffset = (now.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - mondayOffset);
  return monday.toISOString().slice(0, 10);
}

function nextWeek(weekStart: string) {
  const reset = new Date(`${weekStart}T00:00:00.000Z`);
  reset.setUTCDate(reset.getUTCDate() + 7);
  return reset.toISOString();
}

export class GuestLimitStore {
  readonly #cache: LRUCache<string, State>;
  readonly #dirty = new Map<string, Dirty>();
  readonly #loads = new Map<string, Promise<void>>();
  readonly #timer: NodeJS.Timeout;

  constructor(
    private readonly database: Database,
    private readonly config: AppConfig,
    private readonly logger: Logger,
  ) {
    this.#cache = new LRUCache({
      max: config.guestCacheMax,
      ttl: 8 * 86_400_000,
    });
    this.#timer = setInterval(() => void this.flush(), config.guestLimitFlushMs);
    this.#timer.unref();
  }

  async consume(
    guestIds: readonly string[],
    minimumCount = 0,
  ): Promise<GuestLimitResult> {
    const weekStart = currentWeekStart();
    await this.#ensureLoaded(guestIds, weekStart);

    const states = guestIds.map((id) => {
      const current = this.#cache.get(id);
      if (!current || current.weekStart !== weekStart) {
        const reset = { count: 0, weekStart };
        this.#cache.set(id, reset);
        return reset;
      }
      return current;
    });
    if (minimumCount > 0) {
      for (let index = 0; index < guestIds.length; index += 1) {
        const guestId = guestIds[index];
        const state = states[index];
        if (!guestId || !state || state.count >= minimumCount) continue;
        const missingDelta = minimumCount - state.count;
        state.count = minimumCount;
        this.#cache.set(guestId, state);
        const dirty = this.#dirty.get(guestId);
        this.#dirty.set(guestId, {
          delta: dirty?.weekStart === weekStart ? dirty.delta + missingDelta : missingDelta,
          weekStart,
        });
      }
    }
    const highest = Math.max(...states.map((state) => state.count));
    if (highest >= this.config.guestWeeklyLimit) {
      return {
        allowed: false,
        limit: this.config.guestWeeklyLimit,
        remaining: 0,
        resetAt: nextWeek(weekStart),
        weekStart,
        used: highest,
      };
    }

    for (let index = 0; index < guestIds.length; index += 1) {
      const guestId = guestIds[index];
      const state = states[index];
      if (!guestId || !state) continue;
      state.count += 1;
      this.#cache.set(guestId, state);
      const dirty = this.#dirty.get(guestId);
      this.#dirty.set(guestId, {
        delta: dirty?.weekStart === weekStart ? dirty.delta + 1 : 1,
        weekStart,
      });
    }

    return {
      allowed: true,
      limit: this.config.guestWeeklyLimit,
      remaining: Math.max(0, this.config.guestWeeklyLimit - highest - 1),
      resetAt: nextWeek(weekStart),
      weekStart,
      used: highest + 1,
    };
  }

  async #ensureLoaded(guestIds: readonly string[], weekStart: string) {
    const pending: Promise<void>[] = [];
    const missing: string[] = [];
    for (const guestId of guestIds) {
      if (this.#cache.has(guestId)) continue;
      const existing = this.#loads.get(guestId);
      if (existing) pending.push(existing);
      else missing.push(guestId);
    }
    if (missing.length) {
      const load = this.#load(missing, weekStart).finally(() => {
        for (const guestId of missing) this.#loads.delete(guestId);
      });
      for (const guestId of missing) this.#loads.set(guestId, load);
      pending.push(load);
    }
    if (pending.length) await Promise.all(pending);
  }

  async #load(guestIds: string[], weekStart: string) {
    const result = await this.database.query<{
      guest_id: string;
      request_count: number;
      week_start: string;
    }>({
      name: "rate-limits-load",
      text: `SELECT guest_id, request_count, week_start::text AS week_start
             FROM rate_limits
             WHERE guest_id = ANY($1::varchar[])`,
      values: [guestIds],
    });
    const found = new Map(result.rows.map((row) => [row.guest_id, row]));
    for (const guestId of guestIds) {
      const row = found.get(guestId);
      this.#cache.set(guestId, {
        count: row?.week_start === weekStart ? row.request_count : 0,
        weekStart,
      });
    }
  }

  async flush() {
    if (this.#dirty.size === 0) return;
    const batch = [...this.#dirty.entries()];
    this.#dirty.clear();
    const guestIds = batch.map(([guestId]) => guestId);
    const deltas = batch.map(([, dirty]) => dirty.delta);
    const weekStarts = batch.map(([, dirty]) => dirty.weekStart);
    try {
      await this.database.query({
        text: `INSERT INTO rate_limits AS current
                 (guest_id, request_count, week_start, updated_at)
               SELECT guest_id, delta, week_start, now()
               FROM unnest($1::varchar[], $2::smallint[], $3::date[])
                 AS pending(guest_id, delta, week_start)
               ON CONFLICT (guest_id) DO UPDATE SET
                 request_count = CASE
                   WHEN current.week_start = EXCLUDED.week_start
                     THEN current.request_count + EXCLUDED.request_count
                   WHEN current.week_start < EXCLUDED.week_start
                     THEN EXCLUDED.request_count
                   ELSE current.request_count
                 END,
                 week_start = GREATEST(current.week_start, EXCLUDED.week_start),
                 updated_at = now()`,
        values: [guestIds, deltas, weekStarts],
      });
    } catch (error) {
      for (const [guestId, dirty] of batch) {
        const existing = this.#dirty.get(guestId);
        this.#dirty.set(guestId, {
          delta: existing?.weekStart === dirty.weekStart ? existing.delta + dirty.delta : dirty.delta,
          weekStart: dirty.weekStart,
        });
      }
      this.logger.warn({ err: error, entries: batch.length }, "could not flush guest limits");
    }
  }

  stop() {
    clearInterval(this.#timer);
  }
}
