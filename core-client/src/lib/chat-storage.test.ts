import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MODEL_ID } from "@/config/models";
import type { ChatMessage, RemoteChatMessage } from "@/types/chat";
import {
  clearAccountChats,
  clearChatStore,
  getChatSnapshot,
  mergeRemoteMessages,
  saveChatStore,
} from "./chat-storage";

beforeEach(() => {
  window.localStorage.clear();
});

describe("clearChatStore", () => {
  it("removes every local chat and notifies mounted subscribers", () => {
    const onChange = vi.fn();
    window.addEventListener("hermes-chat-change", onChange);
    saveChatStore({
      activeChatId: "chat-1",
      draftModelId: DEFAULT_MODEL_ID,
      chats: [
        {
          id: "chat-1",
          title: "Приватный чат",
          modelId: DEFAULT_MODEL_ID,
          messages: [],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    onChange.mockClear();

    expect(clearChatStore()).toBe(true);
    expect(window.localStorage.getItem("hermes-chat")).toBeNull();
    expect(getChatSnapshot().chats).toEqual([]);
    expect(getChatSnapshot().activeChatId).toBeNull();
    expect(onChange).toHaveBeenCalledOnce();

    window.removeEventListener("hermes-chat-change", onChange);
  });
});

describe("clearAccountChats", () => {
  it("removes account chats and keeps guest chats", () => {
    saveChatStore({
      activeChatId: "account-chat",
      draftModelId: DEFAULT_MODEL_ID,
      chats: [
        {
          id: "account-chat",
          title: "Чат пользователя",
          modelId: DEFAULT_MODEL_ID,
          messages: [],
          ownerUserId: "user-1",
          createdAt: 1,
          updatedAt: 1,
        },
        {
          id: "legacy-account-chat",
          title: "Синхронизированный чат без владельца",
          modelId: DEFAULT_MODEL_ID,
          messages: [],
          isSynced: true,
          createdAt: 2,
          updatedAt: 2,
        },
        {
          id: "guest-chat",
          title: "Гостевой чат",
          modelId: DEFAULT_MODEL_ID,
          messages: [],
          createdAt: 3,
          updatedAt: 3,
        },
      ],
    });

    expect(clearAccountChats()).toBe(true);
    expect(getChatSnapshot().chats.map((chat) => chat.id)).toEqual([
      "guest-chat",
    ]);
    expect(getChatSnapshot().activeChatId).toBeNull();
  });
});

describe("mergeRemoteMessages", () => {
  const remote: RemoteChatMessage = {
    id: "message-1",
    role: "user",
    content: "Что на фото?",
    modelId: null,
    hasAttachment: true,
    attachmentMeta: [
      {
        id: "file-1",
        name: "photo.jpg",
        kind: "image",
        mimeType: "image/jpeg",
        size: 100,
      },
    ],
    createdAt: "2026-08-10T00:00:00.000Z",
  };

  it("shows a placeholder when the local file is absent", () => {
    const [message] = mergeRemoteMessages([remote]);
    expect(message?.content).toContain("Этот файл был обработан на другом устройстве");
    expect(message?.attachments).toBeUndefined();
    expect(message?.createdAt).toBe(Date.parse(remote.createdAt));
  });

  it("restores a matching local attachment without a placeholder", () => {
    const local: ChatMessage = {
      id: remote.id,
      role: "user",
      content: remote.content,
      attachments: [
        {
          ...remote.attachmentMeta![0],
          kind: "image",
          dataUrl: "data:image/jpeg;base64,AA==",
        },
      ],
    };
    const [message] = mergeRemoteMessages([remote], [local]);
    expect(message?.content).toBe(remote.content);
    expect(message?.attachments).toHaveLength(1);
  });
});
