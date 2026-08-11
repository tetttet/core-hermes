import { LRUCache } from "lru-cache";
import type { AppConfig } from "../config.js";

export type Profile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  age: number;
  createdAt: string;
  lastActiveAt: string;
};

export type CachedChatsPage = {
  items: unknown[];
  nextCursor: string | null;
};

export function createCaches(config: AppConfig) {
  return {
    profiles: new LRUCache<string, Profile>({
      max: config.profileCacheMax,
      ttl: config.profileCacheTtlMs,
    }),
    chats: new LRUCache<string, CachedChatsPage>({
      max: config.chatsCacheMax,
      ttl: config.chatsCacheTtlMs,
    }),
  };
}

export type Caches = ReturnType<typeof createCaches>;
