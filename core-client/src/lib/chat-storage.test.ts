import { describe, expect, it } from "vitest";
import type { ChatMessage, RemoteChatMessage } from "@/types/chat";
import { mergeRemoteMessages } from "./chat-storage";

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
