import { describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "@/types/chat";
import {
  ChatStreamError,
  consumeChatResponse,
  prepareApiMessages,
} from "./chat-stream";

function chunkedResponse(chunks: string[]) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
        controller.close();
      },
    }),
  );
}

describe("consumeChatResponse", () => {
  it("joins NDJSON deltas split across network chunks", async () => {
    const onDelta = vi.fn();
    const onModel = vi.fn();
    const response = chunkedResponse([
      '{"type":"model","model":"nvidia/exact-model"}\n',
      '{"type":"delta","content":"При',
      'вет"}\n{"type":"delta","content":"!"}\n',
      '{"type":"done","model":"nvidia/exact-model"}\n',
    ]);

    await expect(
      consumeChatResponse(response, { onDelta, onModel }),
    ).resolves.toEqual({
      content: "Привет!",
      model: "nvidia/exact-model",
      fallbackFrom: undefined,
    });
    expect(onDelta).toHaveBeenLastCalledWith("!", "Привет!");
    expect(onModel).toHaveBeenCalledWith("nvidia/exact-model");
  });

  it("keeps partial content when an in-stream error arrives", async () => {
    const response = chunkedResponse([
      '{"type":"delta","content":"Часть ответа"}\n',
      '{"type":"error","error":"Обрыв","retryable":true}\n',
    ]);

    const error = await consumeChatResponse(response, {
      onDelta: () => undefined,
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ChatStreamError);
    expect(error).toMatchObject({
      message: "Обрыв",
      partialContent: "Часть ответа",
      retryable: true,
    });
  });

  it("reports a stream that ends without a done event", async () => {
    const response = chunkedResponse([
      '{"type":"delta","content":"Незакончено"}\n',
    ]);

    await expect(
      consumeChatResponse(response, { onDelta: () => undefined }),
    ).rejects.toMatchObject({ partialContent: "Незакончено" });
  });

  it("reports retry and fallback statuses without treating them as content", async () => {
    const onStatus = vi.fn();
    const onFallback = vi.fn();
    const response = chunkedResponse([
      '{"type":"status","phase":"retrying","message":"Пробуем повторно..."}\n',
      '{"type":"fallback","fromModel":"primary","toModel":"backup"}\n',
      '{"type":"delta","content":"Готово"}\n',
      '{"type":"done","model":"backup","fallbackFrom":"primary"}\n',
    ]);

    await expect(
      consumeChatResponse(response, {
        onDelta: () => undefined,
        onStatus,
        onFallback,
      }),
    ).resolves.toEqual({
      content: "Готово",
      model: "backup",
      fallbackFrom: "primary",
    });
    expect(onStatus).toHaveBeenCalledWith(
      expect.objectContaining({ phase: "retrying" }),
    );
    expect(onFallback).toHaveBeenCalledWith(
      expect.objectContaining({ fromModel: "primary", toModel: "backup" }),
    );
  });
});

describe("prepareApiMessages", () => {
  it("does not resend old base64 attachments or local UI statuses", () => {
    const messages: ChatMessage[] = [
      {
        id: "old-media",
        role: "user",
        content: "Старое фото",
        status: "error",
        attachments: [
          {
            id: "image",
            name: "old.png",
            kind: "image",
            mimeType: "image/png",
            dataUrl: "data:image/png;base64,AAAA",
            size: 3,
          },
        ],
      },
      { id: "answer", role: "assistant", content: "Описание" },
      { id: "latest", role: "user", content: "Продолжай" },
    ];

    const prepared = prepareApiMessages(messages);
    expect(prepared[0].attachments).toBeUndefined();
    expect("status" in prepared[0]).toBe(false);
    expect(JSON.stringify(prepared)).not.toContain("AAAA");
  });

  it("sends extracted video frames without the large original video", () => {
    const prepared = prepareApiMessages([
      {
        id: "video-message",
        role: "user",
        content: "Что на видео?",
        attachments: [
          {
            id: "video",
            name: "clip.mp4",
            kind: "video",
            mimeType: "video/mp4",
            dataUrl: "data:video/mp4;base64,LARGE_VIDEO",
            size: 100,
            videoFrames: ["data:image/jpeg;base64,FRAME"],
          },
        ],
      },
    ]);

    expect(JSON.stringify(prepared)).not.toContain("LARGE_VIDEO");
    expect(JSON.stringify(prepared)).toContain("FRAME");
  });

  it("limits long histories before sending them to the API", () => {
    const messages: ChatMessage[] = Array.from({ length: 81 }, (_, index) => ({
      id: String(index),
      role: index % 2 === 0 ? "user" : "assistant",
      content: `Сообщение ${index}`,
    }));

    const prepared = prepareApiMessages(messages);
    expect(prepared.length).toBeLessThanOrEqual(32);
    expect(prepared[0].role).toBe("user");
    expect(prepared.at(-1)?.id).toBe("80");
  });
});
