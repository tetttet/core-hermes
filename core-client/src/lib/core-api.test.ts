import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MODEL_ID } from "@/config/models";
import type { ChatThread } from "@/types/chat";
import {
  deleteAllRemoteChats,
  loadRemoteChats,
  loadRemoteMessages,
  refreshSession,
} from "./core-api";

describe("remote chat history", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads lightweight chat titles first and messages only when requested", async () => {
    const localChats: ChatThread[] = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        title: "Локальная копия",
        modelId: DEFAULT_MODEL_ID,
        messages: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            role: "user",
            content: "Старый текст",
            attachments: [
              {
                id: "file-1",
                name: "photo.jpg",
                kind: "image",
                mimeType: "image/jpeg",
                dataUrl: "data:image/jpeg;base64,AA==",
                size: 1,
              },
            ],
          },
        ],
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/messages?")) {
        return Response.json({
          items: [
            {
              id: "22222222-2222-4222-8222-222222222222",
              role: "user",
              content: "Текст из базы",
              modelId: null,
              hasAttachment: true,
              attachmentMeta: [
                {
                  id: "file-1",
                  name: "photo.jpg",
                  kind: "image",
                  mimeType: "image/jpeg",
                  size: 1,
                },
              ],
              createdAt: "2026-08-10T00:00:00.000Z",
            },
          ],
          nextCursor: null,
        });
      }

      return Response.json({
        items: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            title: "Чат из базы",
            modelId: DEFAULT_MODEL_ID,
            isFavorite: true,
            createdAt: "2026-08-10T00:00:00.000Z",
            updatedAt: "2026-08-10T01:00:00.000Z",
          },
        ],
        nextCursor: null,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const chatPage = await loadRemoteChats(localChats);
    const chat = chatPage.items[0];

    expect(chat?.title).toBe("Чат из базы");
    expect(chat?.messages[0]?.content).toBe("Старый текст");
    expect(chat?.messagesLoaded).toBe(false);
    expect(chat?.isFavorite).toBe(true);
    expect(chat?.isSynced).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("limit=30");
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain("/messages?");

    const messagePage = await loadRemoteMessages(
      chat!.id,
      chat!.messages,
    );

    expect(messagePage.items[0]?.content).toBe("Текст из базы");
    expect(messagePage.items[0]?.attachments?.[0]?.name).toBe("photo.jpg");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("deletes the complete paginated remote chat history", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "DELETE") return new Response(null, { status: 204 });

      const isSecondPage = url.includes("cursor=next-page");
      return Response.json({
        items: (isSecondPage ? ["chat-3"] : ["chat-1", "chat-2"]).map((id) => ({
          id,
          title: id,
          modelId: DEFAULT_MODEL_ID,
          isFavorite: false,
          createdAt: "2026-08-10T00:00:00.000Z",
          updatedAt: "2026-08-10T01:00:00.000Z",
        })),
        nextCursor: isSecondPage ? null : "next-page",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteAllRemoteChats()).resolves.toBe(3);

    const calls = fetchMock.mock.calls.map(([input, init]) => ({
      url: String(input),
      method: init?.method ?? "GET",
    }));
    expect(calls.filter((call) => call.method === "GET")).toHaveLength(2);
    expect(calls[0]?.url).toContain("limit=100");
    expect(calls.filter((call) => call.method === "DELETE")).toHaveLength(3);
  });

  it("deduplicates concurrent refresh token rotations", async () => {
    let resolveFetch!: (response: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    }));
    vi.stubGlobal("fetch", fetchMock);

    const first = refreshSession();
    const second = refreshSession();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveFetch(new Response(null, { status: 204 }));

    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    });
  });

  it("does not treat a temporary refresh failure as an expired session", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 503 })));

    await expect(refreshSession()).rejects.toThrow("Не удалось обновить сессию");
  });
});
