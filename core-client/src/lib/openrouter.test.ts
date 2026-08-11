import { describe, expect, it, vi } from "vitest";
import {
  AUTO_MODEL_ID,
  MODELS,
  VISION_FALLBACK_MODEL_IDS,
} from "@/config/models";
import type { ChatAttachment, ChatMessage } from "@/types/chat";
import {
  createOpenRouterStream,
  prepareOpenRouterMessages,
} from "./openrouter";

const userMessage: ChatMessage = {
  id: "user",
  role: "user",
  content: "Ответь одним словом",
};
const API_MODELS = MODELS.filter((model) => model.id !== AUTO_MODEL_ID);
const MANUAL_MODEL_ID = "google/gemma-4-31b-it:free";

function sseResponse(content = "Готово") {
  return new Response(
    `: OPENROUTER PROCESSING\n\ndata: ${JSON.stringify({
      model: "actual/model",
      choices: [{ delta: { content } }],
    })}\n\ndata: [DONE]\n\n`,
    { headers: { "Content-Type": "text/event-stream" } },
  );
}

function streamText(stream: ReadableStream<Uint8Array>) {
  return new Response(stream).text();
}

describe("prepareOpenRouterMessages", () => {
  it("keeps only the newest attachment as base64", () => {
    const oldAttachment: ChatAttachment = {
      id: "old",
      name: "old.png",
      kind: "image",
      mimeType: "image/png",
      dataUrl: "data:image/png;base64,OLD",
      size: 2,
    };
    const newAttachment: ChatAttachment = {
      ...oldAttachment,
      id: "new",
      name: "new.mp4",
      kind: "video",
      mimeType: "video/mp4",
      dataUrl: "data:video/mp4;base64,NEW",
    };
    const prepared = prepareOpenRouterMessages([
      { ...userMessage, id: "old-message", attachments: [oldAttachment] },
      { id: "assistant", role: "assistant", content: "Старое описание" },
      { ...userMessage, id: "new-message", attachments: [newAttachment] },
    ]);

    expect(JSON.stringify(prepared[0])).toContain("old.png");
    expect(JSON.stringify(prepared[0])).not.toContain("base64,OLD");
    expect(JSON.stringify(prepared.at(-1))).toContain("base64,NEW");
    expect(JSON.stringify(prepared.at(-1))).toContain("video_url");
  });

  it("converts prepared video frames to chronological image inputs", () => {
    const prepared = prepareOpenRouterMessages([
      {
        id: "video-message",
        role: "user",
        content: "Опиши",
        attachments: [
          {
            id: "video",
            name: "clip.mp4",
            kind: "video",
            mimeType: "video/mp4",
            size: 100,
            videoFrames: [
              "data:image/jpeg;base64,FIRST",
              "data:image/jpeg;base64,LAST",
            ],
          },
        ],
      },
    ]);
    const serialized = JSON.stringify(prepared);

    expect(serialized).toContain("ключевыми кадрами");
    expect(serialized).toContain("base64,FIRST");
    expect(serialized).toContain("base64,LAST");
    expect(serialized).not.toContain("video_url");
  });
});

describe("createOpenRouterStream", () => {
  it.each(API_MODELS)("sends only the explicitly selected model $id", async (model) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => sseResponse());
    const stream = createOpenRouterStream({
      apiKey: "test-key",
      appUrl: "http://localhost:3000",
      model: model.id,
      messages: [userMessage],
      signal: new AbortController().signal,
      fetchImpl,
    });

    const output = await streamText(stream);
    expect(output).toContain('"type":"delta","content":"Готово"');
    expect(output).toContain('"type":"done"');

    const request = fetchImpl.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(request.body)) as {
      model: string;
      messages: Array<{ role: string; content: string }>;
      stream: boolean;
      provider: { allow_fallbacks: boolean };
    };
    expect(body.model).toBe(model.id);
    expect(body).not.toHaveProperty("models");
    expect(body.messages[0]).toMatchObject({ role: "system" });
    expect(body.messages[0].content).toContain("User Safety");
    expect(body.stream).toBe(true);
    expect(body.provider.allow_fallbacks).toBe(true);
  });

  it("filters Auto routing by video capability", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => sseResponse("Видео"));
    const video: ChatAttachment = {
      id: "video",
      name: "clip.mp4",
      kind: "video",
      mimeType: "video/mp4",
      dataUrl: "data:video/mp4;base64,AAAA",
      size: 3,
    };

    await streamText(
      createOpenRouterStream({
        apiKey: "test-key",
        appUrl: "http://localhost:3000",
        model: AUTO_MODEL_ID,
        messages: [{ ...userMessage, attachments: [video] }],
        signal: new AbortController().signal,
        fetchImpl,
      }),
    );

    const request = fetchImpl.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(request.body)) as {
      model: string;
      messages: unknown;
    };
    expect(body.model).toBe("google/gemma-4-26b-a4b-it:free");
    expect(body.model).not.toBe(VISION_FALLBACK_MODEL_IDS[0]);
    expect(JSON.stringify(body.messages)).toContain("video_url");
  });

  it("retries a transient error before any content", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ error: { message: "overloaded" } }, { status: 503 }),
      )
      .mockResolvedValueOnce(sseResponse("После повтора"));

    const output = await streamText(
      createOpenRouterStream({
        apiKey: "test-key",
        appUrl: "http://localhost:3000",
        model: MANUAL_MODEL_ID,
        messages: [userMessage],
        signal: new AbortController().signal,
        fetchImpl,
        retryBaseDelayMs: 0,
      }),
    );

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(output).toContain("После повтора");
    const secondRequest = fetchImpl.mock.calls[1][1] as RequestInit;
    const secondBody = JSON.parse(String(secondRequest.body)) as { model: string };
    expect(secondBody.model).toBe(MANUAL_MODEL_ID);
  });

  it("falls back through the vision allowlist after retries", async () => {
    const image: ChatAttachment = {
      id: "image",
      name: "photo.png",
      kind: "image",
      mimeType: "image/png",
      dataUrl: "data:image/png;base64,AAAA",
      size: 3,
    };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(sseResponse("Резерв ответил"));

    const output = await streamText(
      createOpenRouterStream({
        apiKey: "test-key",
        appUrl: "http://localhost:3000",
        model: AUTO_MODEL_ID,
        messages: [{ ...userMessage, attachments: [image] }],
        signal: new AbortController().signal,
        fetchImpl,
        retryBaseDelayMs: 0,
      }),
    );

    const requestedModels = fetchImpl.mock.calls.map((call) => {
      const request = call[1] as RequestInit;
      return (JSON.parse(String(request.body)) as { model: string }).model;
    });
    expect(requestedModels).toEqual([
      VISION_FALLBACK_MODEL_IDS[0],
      VISION_FALLBACK_MODEL_IDS[0],
      VISION_FALLBACK_MODEL_IDS[0],
      VISION_FALLBACK_MODEL_IDS[1],
    ]);
    expect(output).toContain('"type":"fallback"');
    expect(output).toContain("Переключаемся на резервную модель");
    expect(output).toContain("Резерв ответил");
  });

  it("preserves partial content and emits a controlled mid-stream error", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response(
        `data: ${JSON.stringify({
          choices: [{ delta: { content: "Начало" } }],
        })}\n\ndata: ${JSON.stringify({
          error: { code: 502, message: "disconnect" },
          choices: [{ delta: { content: "" }, finish_reason: "error" }],
        })}\n\n`,
      ),
    );

    const output = await streamText(
      createOpenRouterStream({
        apiKey: "test-key",
        appUrl: "http://localhost:3000",
        model: MANUAL_MODEL_ID,
        messages: [userMessage],
        signal: new AbortController().signal,
        fetchImpl,
      }),
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(output).toContain("Начало");
    expect(output).toContain('"type":"error"');
    expect(output).toContain("Частичный ответ сохранён");
  });

  it("treats an abrupt EOF after content as a recoverable partial response", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response(
        `data: ${JSON.stringify({
          choices: [{ delta: { content: "Есть только часть" } }],
        })}\n\n`,
      ),
    );

    const output = await streamText(
      createOpenRouterStream({
        apiKey: "test-key",
        appUrl: "http://localhost:3000",
        model: MANUAL_MODEL_ID,
        messages: [userMessage],
        signal: new AbortController().signal,
        fetchImpl,
      }),
    );

    expect(output).toContain("Есть только часть");
    expect(output).toContain('"type":"error"');
  });
});
