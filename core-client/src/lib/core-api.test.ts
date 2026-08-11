import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MODEL_ID } from "@/config/models";
import type { ChatThread } from "@/types/chat";
import { loadRemoteHistory } from "./core-api";

describe("remote chat history", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads text from the server and keeps a matching file on this device", async () => {
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

    const [chat] = await loadRemoteHistory(localChats);

    expect(chat?.title).toBe("Чат из базы");
    expect(chat?.messages[0]?.content).toBe("Текст из базы");
    expect(chat?.messages[0]?.attachments?.[0]?.name).toBe("photo.jpg");
    expect(chat?.isFavorite).toBe(true);
    expect(chat?.isSynced).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
