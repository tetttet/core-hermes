import { mergeRemoteMessages } from "./chat-storage";
import type { ChatMessage, ChatThread, RemoteChatMessage } from "@/types/chat";

const API_BASE = process.env.NEXT_PUBLIC_CORE_API_URL?.replace(/\/$/, "") ?? "";
const DEVICE_ID_KEY = "hermes-device-id";

type ApiErrorBody = { error?: string };

export type UserProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  age: number;
  createdAt: string;
  lastActiveAt: string;
};

export type SurveyAnswer = { questionKey: string; answer: string };

function endpoint(path: string) {
  if (API_BASE) return `${API_BASE}${path}`;
  return path === "/api/chat/stream" ? "/api/chat" : path;
}

function deviceId() {
  const existing = window.localStorage.getItem(DEVICE_ID_KEY);
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing || "")) {
    return existing!;
  }
  const created = crypto.randomUUID();
  window.localStorage.setItem(DEVICE_ID_KEY, created);
  return created;
}

async function apiFetch(path: string, init: RequestInit = {}, retry = true) {
  const response = await fetch(endpoint(path), {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  if (response.status === 401 && retry && !path.startsWith("/api/auth/")) {
    const refreshed = await refreshSession();
    if (refreshed) return apiFetch(path, init, false);
  }
  return response;
}

async function json<T>(response: Response): Promise<T> {
  const body = await response.json() as T & ApiErrorBody;
  if (!response.ok) throw new Error(body.error || "Ошибка API");
  return body;
}

export function streamChat(body: unknown, signal: AbortSignal) {
  return apiFetch("/api/chat/stream", {
    method: "POST",
    body: JSON.stringify(body),
    signal,
    headers: { "X-Device-Id": deviceId() },
  });
}

export async function register(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  age: number;
  survey: SurveyAnswer[];
}) {
  return json<{ user: UserProfile; accessToken: string }>(
    await apiFetch("/api/auth/register", { method: "POST", body: JSON.stringify(input) }),
  );
}

export async function login(email: string, password: string) {
  return json<{ user: UserProfile; accessToken: string }>(
    await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  );
}

export async function logout() {
  const response = await apiFetch("/api/auth/logout", { method: "POST" }, false);
  if (!response.ok) throw new Error("Не удалось завершить сессию");
}

export async function currentUser() {
  let response = await apiFetch("/api/auth/me", {}, false);
  if (response.status === 401 && await refreshSession()) {
    response = await apiFetch("/api/auth/me", {}, false);
  }
  if (response.status === 401) return null;
  return (await json<{ user: UserProfile }>(response)).user;
}

export async function refreshSession() {
  const response = await fetch(endpoint("/api/auth/refresh"), {
    method: "POST",
    credentials: "include",
  });
  return response.ok;
}

export async function listChats(cursor?: string, limit = 30) {
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set("cursor", cursor);
  return json<{
    items: Array<{
      id: string;
      title: string;
      modelId: string;
      isFavorite: boolean;
      createdAt: string;
      updatedAt: string;
    }>;
    nextCursor: string | null;
  }>(await apiFetch(`/api/chats?${query}`));
}

export async function updateRemoteChat(
  chatId: string,
  update: { title?: string; modelId?: string; isFavorite?: boolean },
) {
  return json<{ chat: Omit<ChatThread, "messages" | "createdAt" | "updatedAt"> & {
    createdAt: string;
    updatedAt: string;
  } }>(
    await apiFetch(`/api/chats/${chatId}`, {
      method: "PATCH",
      body: JSON.stringify(update),
    }),
  );
}

export async function deleteRemoteChat(chatId: string) {
  const response = await apiFetch(`/api/chats/${chatId}`, { method: "DELETE" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as ApiErrorBody;
    throw new Error(body.error || "Не удалось удалить чат");
  }
}

export async function deleteAllRemoteChats() {
  const chatIds: string[] = [];
  let cursor: string | undefined;

  do {
    const page = await listChats(cursor, 100);
    chatIds.push(...page.items.map((chat) => chat.id));
    cursor = page.nextCursor ?? undefined;
  } while (cursor);

  const batchSize = 8;
  for (let index = 0; index < chatIds.length; index += batchSize) {
    await Promise.all(
      chatIds.slice(index, index + batchSize).map((chatId) =>
        deleteRemoteChat(chatId),
      ),
    );
  }

  return chatIds.length;
}

export async function listMessages(
  chatId: string,
  localMessages: ChatMessage[],
  cursor?: string,
  limit = 50,
) {
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set("cursor", cursor);
  const page = await json<{ items: RemoteChatMessage[]; nextCursor: string | null }>(
    await apiFetch(`/api/chats/${chatId}/messages?${query}`),
  );
  return { ...page, items: mergeRemoteMessages(page.items, localMessages) };
}

export async function loadRemoteChats(
  localChats: ChatThread[],
  cursor?: string,
  limit = 30,
) {
  const page = await listChats(cursor, limit);
  const localById = new Map(localChats.map((chat) => [chat.id, chat]));
  const items = page.items.map((remote): ChatThread => {
    const local = localById.get(remote.id);
    const createdAt = Date.parse(remote.createdAt);
    const updatedAt = Date.parse(remote.updatedAt);

    return {
      id: remote.id,
      title: remote.title,
      modelId: remote.modelId,
      messages: local?.messages ?? [],
      messagesLoaded: false,
      ...(remote.isFavorite ? { isFavorite: true } : {}),
      isSynced: true,
      createdAt: Number.isFinite(createdAt) ? createdAt : 0,
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
    };
  });

  return { items, nextCursor: page.nextCursor };
}

export function loadRemoteMessages(
  chatId: string,
  localMessages: ChatMessage[],
  cursor?: string,
  limit = 50,
) {
  return listMessages(chatId, localMessages, cursor, limit);
}
