import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MODEL_ID } from "@/config/models";

vi.mock("./core-api", () => ({
  currentUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  refreshSession: vi.fn(),
  register: vi.fn(),
}));

const user = {
  id: "user-1",
  email: "user@example.com",
  firstName: "Иван",
  lastName: "Иванов",
  age: 30,
  createdAt: "2026-01-01T00:00:00.000Z",
  lastActiveAt: "2026-08-11T00:00:00.000Z",
};

async function loadModules() {
  const coreApi = await import("./core-api");
  const authStore = await import("./auth-store");
  const chatStorage = await import("./chat-storage");
  return { coreApi, authStore, chatStorage };
}

beforeEach(() => {
  window.localStorage.clear();
  vi.resetModules();
});

describe("auth chat privacy", () => {
  it("removes cached account chats when initial auth check fails", async () => {
    const { coreApi, authStore, chatStorage } = await loadModules();
    vi.mocked(coreApi.currentUser).mockRejectedValue(new Error("network error"));
    chatStorage.saveChatStore({
      activeChatId: "account-chat",
      draftModelId: DEFAULT_MODEL_ID,
      chats: [
        {
          id: "account-chat",
          title: "Чат пользователя",
          modelId: DEFAULT_MODEL_ID,
          messages: [],
          isSynced: true,
          createdAt: 1,
          updatedAt: 1,
        },
        {
          id: "guest-chat",
          title: "Гостевой чат",
          modelId: DEFAULT_MODEL_ID,
          messages: [],
          createdAt: 2,
          updatedAt: 2,
        },
      ],
    });

    await authStore.initializeAuth();

    expect(authStore.getAuthSnapshot()).toEqual({
      status: "guest",
      user: null,
    });
    expect(chatStorage.getChatSnapshot().chats.map((chat) => chat.id)).toEqual([
      "guest-chat",
    ]);
    expect(chatStorage.getChatSnapshot().activeChatId).toBeNull();
  });

  it("clears account chats after the server confirms logout", async () => {
    const { coreApi, authStore, chatStorage } = await loadModules();
    vi.mocked(coreApi.currentUser).mockResolvedValue(user);
    vi.mocked(coreApi.logout).mockResolvedValue(undefined);
    await authStore.initializeAuth();
    chatStorage.saveChatStore({
      activeChatId: "chat-1",
      draftModelId: DEFAULT_MODEL_ID,
      chats: [
        {
          id: "chat-1",
          title: "Чат пользователя",
          modelId: DEFAULT_MODEL_ID,
          messages: [],
          isSynced: true,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });

    await authStore.signOut();

    expect(coreApi.logout).toHaveBeenCalledOnce();
    expect(authStore.getAuthSnapshot()).toEqual({ status: "guest", user: null });
    expect(chatStorage.getChatSnapshot().chats).toEqual([]);
    expect(window.localStorage.getItem("hermes-chat")).toBeNull();
  });
});
