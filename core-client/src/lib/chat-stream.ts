import type {
  ChatMessage,
  ChatRequestAttachment,
  ChatRequestMessage,
} from "@/types/chat";
import type { ChatStreamEvent } from "./openrouter";

const MAX_API_MESSAGES = 32;
const MAX_API_CHARACTERS = 80_000;

export class ChatStreamError extends Error {
  partialContent: string;
  retryable: boolean;

  constructor(message: string, partialContent = "", retryable = true) {
    super(message);
    this.name = "ChatStreamError";
    this.partialContent = partialContent;
    this.retryable = retryable;
  }
}

type StatusEvent = Extract<ChatStreamEvent, { type: "status" }>;
type FallbackEvent = Extract<ChatStreamEvent, { type: "fallback" }>;

type ChatResponseHandlers = {
  onDelta: (content: string, fullContent: string) => void;
  onModel?: (modelId: string) => void;
  onStatus?: (event: StatusEvent) => void;
  onFallback?: (event: FallbackEvent) => void;
};

export function prepareApiMessages(messages: ChatMessage[]) {
  const usefulMessages = messages.filter(
    (message) => message.content.trim() || message.attachments?.length,
  );
  const selected: ChatMessage[] = [];
  let characters = 0;

  for (
    let index = usefulMessages.length - 1;
    index >= 0 && selected.length < MAX_API_MESSAGES;
    index -= 1
  ) {
    const message = usefulMessages[index];
    const cost = message.content.length;
    if (selected.length > 0 && characters + cost > MAX_API_CHARACTERS) break;
    selected.unshift(message);
    characters += cost;
  }

  const firstUserIndex = selected.findIndex((message) => message.role === "user");
  const compacted = firstUserIndex > 0 ? selected.slice(firstUserIndex) : selected;
  const latestIndex = compacted.length - 1;

  return compacted.map((message, index): ChatRequestMessage => {
    const attachments =
      index === latestIndex
        ? message.attachments?.map(
            (attachment): ChatRequestAttachment => {
              if (attachment.kind !== "video" || !attachment.videoFrames?.length) {
                return attachment;
              }

              const requestAttachment: ChatRequestAttachment = { ...attachment };
              delete requestAttachment.dataUrl;
              return requestAttachment;
            },
          )
        : undefined;

    return {
      id: message.id,
      role: message.role,
      content: message.content,
      attachments,
    };
  });
}

async function responseError(response: Response) {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error;
  } catch {
    return undefined;
  }
}

export async function consumeChatResponse(
  response: Response,
  {
    onDelta,
    onModel = () => undefined,
    onStatus = () => undefined,
    onFallback = () => undefined,
  }: ChatResponseHandlers,
) {
  if (!response.ok) {
    throw new ChatStreamError(
      (await responseError(response)) || "Не удалось получить ответ",
      "",
      response.status === 408 || response.status === 429 || response.status >= 500,
    );
  }
  if (!response.body) {
    throw new ChatStreamError("Сервер вернул пустой ответ");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let didFinish = false;
  let responseModel: string | undefined;
  let fallbackFrom: string | undefined;

  const processLine = (line: string) => {
    if (!line.trim()) return;

    let event: ChatStreamEvent;
    try {
      event = JSON.parse(line) as ChatStreamEvent;
    } catch {
      throw new ChatStreamError("Сервер вернул повреждённый поток", content);
    }

    if (event.type === "delta") {
      content += event.content;
      onDelta(event.content, content);
      return;
    }
    if (event.type === "error") {
      throw new ChatStreamError(event.error, content, event.retryable);
    }
    if (event.type === "model") {
      responseModel = event.model;
      onModel(event.model);
      return;
    }
    if (event.type === "status") {
      onStatus(event);
      return;
    }
    if (event.type === "fallback") {
      fallbackFrom ??= event.fromModel;
      onFallback(event);
      return;
    }
    if (event.type === "done") {
      didFinish = true;
      fallbackFrom ??= event.fallbackFrom;
      if (event.model && event.model !== responseModel) {
        responseModel = event.model;
        onModel(event.model);
      }
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/, "");
        buffer = buffer.slice(newline + 1);
        processLine(line);
        newline = buffer.indexOf("\n");
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) processLine(buffer.replace(/\r$/, ""));
  } finally {
    reader.releaseLock();
  }

  if (!didFinish || !content.trim()) {
    throw new ChatStreamError(
      content
        ? "Ответ модели оборвался до завершения"
        : "Модель не вернула текст ответа",
      content,
    );
  }

  return { content, model: responseModel, fallbackFrom };
}
