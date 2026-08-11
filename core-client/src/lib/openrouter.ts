import type { AttachmentKind } from "@/config/models";
import { resolveModelRoute } from "@/lib/model-router";
import type {
  ChatRequestAttachment,
  ChatRequestMessage,
} from "@/types/chat";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MAX_HISTORY_MESSAGES = 32;
const MAX_HISTORY_CHARACTERS = 80_000;
const MAX_ATTEMPTS_PER_MODEL = 3;
const DEFAULT_FIRST_TOKEN_TIMEOUT_MS = 180_000;
const DEFAULT_IDLE_TIMEOUT_MS = 180_000;
const DEFAULT_OVERALL_TIMEOUT_MS = 290_000;
const DEFAULT_RETRY_BASE_DELAY_MS = 650;
const SLOW_RESPONSE_NOTICE_MS = 15_000;
const SYSTEM_PROMPT =
  "Отвечай на запрос пользователя напрямую и содержательно. Если есть изображение или кадры видео, проанализируй их и выполни просьбу пользователя. Математику оформляй в Markdown: $...$ внутри строки и $$...$$ отдельным блоком; не используй жирное начертание для формул без смысловой необходимости. Не выводи вместо ответа внутренние служебные классификации вроде User Safety, Response Safety или просто safe/unsafe.";

type OpenRouterContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "video_url"; video_url: { url: string } };

export type OpenRouterMessage = {
  role: ChatRequestMessage["role"] | "system";
  content: string | OpenRouterContentPart[];
};

type OpenRouterChunk = {
  model?: string;
  error?: {
    code?: number | string;
    message?: string;
    metadata?: { error_type?: string };
  };
  choices?: Array<{
    delta?: { content?: string };
    finish_reason?: string | null;
  }>;
};

type OpenRouterErrorResponse = {
  error?: {
    code?: number | string;
    message?: string;
    metadata?: { error_type?: string };
  };
};

export type ChatProgressPhase =
  | "sending"
  | "processing"
  | "slow"
  | "retrying"
  | "fallback";

export type ChatStreamEvent =
  | { type: "delta"; content: string }
  | { type: "model"; model: string }
  | {
      type: "status";
      phase: ChatProgressPhase;
      message: string;
      model?: string;
    }
  | { type: "fallback"; fromModel: string; toModel: string }
  | { type: "done"; model?: string; fallbackFrom?: string }
  | { type: "error"; error: string; retryable: boolean };

type StreamOptions = {
  apiKey: string;
  appUrl: string;
  model: string;
  messages: ChatRequestMessage[];
  signal: AbortSignal;
  allowFallback?: boolean;
  fetchImpl?: typeof fetch;
  firstTokenTimeoutMs?: number;
  idleTimeoutMs?: number;
  overallTimeoutMs?: number;
  retryBaseDelayMs?: number;
};

class UpstreamFailure extends Error {
  retryable: boolean;
  status?: number;

  constructor(message: string, retryable: boolean, status?: number) {
    super(message);
    this.name = "UpstreamFailure";
    this.retryable = retryable;
    this.status = status;
  }
}

function diagnostic(
  level: "info" | "warn",
  event: string,
  details: Record<string, unknown>,
) {
  if (process.env.NODE_ENV === "test") return;
  console[level](`[openrouter] ${event}`, details);
}

function attachmentLabel(attachments: ChatRequestAttachment[]) {
  return `[Ранее приложены файлы: ${attachments
    .map((attachment) => attachment.name)
    .join(", ")}.]`;
}

function messageCharacterCost(message: ChatRequestMessage) {
  return (
    message.content.length +
    (message.attachments?.reduce(
      (sum, attachment) => sum + attachment.name.length + 24,
      0,
    ) ?? 0)
  );
}

export function compactChatHistory(messages: ChatRequestMessage[]) {
  const recent = messages.slice(-MAX_HISTORY_MESSAGES);
  const selected: ChatRequestMessage[] = [];
  let characters = 0;

  for (let index = recent.length - 1; index >= 0; index -= 1) {
    const message = recent[index];
    const cost = messageCharacterCost(message);
    if (selected.length > 0 && characters + cost > MAX_HISTORY_CHARACTERS) break;

    selected.unshift(message);
    characters += cost;
  }

  const firstUserIndex = selected.findIndex((message) => message.role === "user");
  return firstUserIndex > 0 ? selected.slice(firstUserIndex) : selected;
}

function attachmentContentParts(attachment: ChatRequestAttachment) {
  if (attachment.kind === "video" && attachment.videoFrames?.length) {
    return attachment.videoFrames.map(
      (frame): OpenRouterContentPart => ({
        type: "image_url",
        image_url: { url: frame },
      }),
    );
  }

  if (!attachment.dataUrl) return [];
  return [
    attachment.kind === "image"
      ? {
          type: "image_url" as const,
          image_url: { url: attachment.dataUrl },
        }
      : {
          type: "video_url" as const,
          video_url: { url: attachment.dataUrl },
        },
  ];
}

export function prepareOpenRouterMessages(
  messages: ChatRequestMessage[],
): OpenRouterMessage[] {
  const compacted = compactChatHistory(messages);
  const latestIndex = compacted.length - 1;

  return compacted.map((message, index) => {
    const attachments = message.attachments ?? [];

    if (message.role === "assistant" || attachments.length === 0) {
      return { role: message.role, content: message.content };
    }

    if (index !== latestIndex) {
      return {
        role: message.role,
        content: [message.content, attachmentLabel(attachments)]
          .filter(Boolean)
          .join("\n\n"),
      };
    }

    const frameNotes = attachments
      .filter((attachment) => attachment.videoFrames?.length)
      .map(
        (attachment) =>
          `Видео «${attachment.name}» представлено ${attachment.videoFrames?.length ?? 0} ключевыми кадрами в хронологическом порядке.`,
      );

    return {
      role: message.role,
      content: [
        {
          type: "text",
          text: [
            message.content || "Опиши и проанализируй вложение.",
            ...frameNotes,
          ].join("\n\n"),
        },
        ...attachments.flatMap(attachmentContentParts),
      ],
    };
  });
}

function getAttachmentKinds(messages: ChatRequestMessage[]) {
  const kinds = new Set<AttachmentKind>();
  for (const message of messages) {
    for (const attachment of message.attachments ?? []) {
      kinds.add(attachment.kind);
    }
  }
  return [...kinds];
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function userFacingError(error: unknown, hasPartialContent: boolean) {
  if (hasPartialContent) {
    return "Соединение с моделью прервалось. Частичный ответ сохранён — запрос можно повторить.";
  }

  if (error instanceof UpstreamFailure) {
    if (error.status === 401 || error.status === 403) {
      return "OpenRouter отклонил ключ API. Проверьте OPENROUTER_API_KEY.";
    }
    if (error.status === 402) {
      if (/video|\$1|balance/i.test(error.message)) {
        return "Для нативной обработки видео OpenRouter требует баланс не менее $1.";
      }
      return "На аккаунте OpenRouter закончился доступный лимит.";
    }
    if (error.status === 413) {
      return "Запрос со вложением слишком большой. Уменьшите размер файла.";
    }
    if (error.status === 429) {
      return "Бесплатные модели сейчас перегружены. Все разрешённые повторы исчерпаны.";
    }
    if (error.status === 400 || error.status === 404 || error.status === 422) {
      return "Модель не смогла обработать этот запрос или формат вложения.";
    }
    if (/вовремя|таймаут|перестала отвечать/i.test(error.message)) {
      return "Модели не ответили за отведённое время. Запрос можно повторить.";
    }
  }

  return "Не удалось получить ответ от моделей OpenRouter. Попробуйте повторить запрос.";
}

function delay(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }

    const abort = () => {
      clearTimeout(timeout);
      reject(signal.reason);
    };
    const timeout = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", abort, { once: true });
  });
}

function linkAbortSignal(source: AbortSignal, controller: AbortController) {
  const abort = () => controller.abort(source.reason);
  if (source.aborted) abort();
  else source.addEventListener("abort", abort, { once: true });
  return () => source.removeEventListener("abort", abort);
}

async function withDeadline<T>(
  promise: Promise<T>,
  deadline: number,
  controller: AbortController,
  message: string,
) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    controller.abort();
    throw new UpstreamFailure(message, true, 408);
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new UpstreamFailure(message, true, 408));
        }, remaining);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function readError(response: Response) {
  try {
    const data = (await response.json()) as OpenRouterErrorResponse;
    return data.error;
  } catch {
    return undefined;
  }
}

async function consumeSse(
  response: Response,
  options: {
    attemptController: AbortController;
    firstTokenDeadline: number;
    overallDeadline: number;
    idleTimeoutMs: number;
    onDelta: (content: string) => void;
    onModel: (model: string) => void;
  },
) {
  if (!response.body) {
    throw new UpstreamFailure("OpenRouter вернул пустой поток", true, 502);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let hasContent = false;
  let isDone = false;

  const processEvent = (rawEvent: string) => {
    const data = rawEvent
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");

    if (!data) return;
    if (data === "[DONE]") {
      isDone = true;
      return;
    }

    let chunk: OpenRouterChunk;
    try {
      chunk = JSON.parse(data) as OpenRouterChunk;
    } catch {
      return;
    }

    if (chunk.model) options.onModel(chunk.model);
    if (chunk.error) {
      const parsedCode = Number(chunk.error.code);
      const status = Number.isFinite(parsedCode) ? parsedCode : 502;
      throw new UpstreamFailure(
        chunk.error.message || "Ошибка модели внутри потока",
        isRetryableStatus(status),
        status,
      );
    }

    const content = chunk.choices?.[0]?.delta?.content;
    if (content) {
      hasContent = true;
      options.onDelta(content);
    }
    if (chunk.choices?.[0]?.finish_reason) isDone = true;
  };

  try {
    while (!isDone) {
      const deadline = hasContent
        ? Math.min(options.overallDeadline, Date.now() + options.idleTimeoutMs)
        : Math.min(options.overallDeadline, options.firstTokenDeadline);
      const result = await withDeadline(
        reader.read(),
        deadline,
        options.attemptController,
        hasContent
          ? "Модель перестала отвечать во время генерации"
          : "Модель не начала отвечать вовремя",
      );

      if (result.done) break;
      buffer += decoder.decode(result.value, { stream: true });

      let boundary = buffer.search(/\r?\n\r?\n/);
      while (boundary >= 0) {
        const event = buffer.slice(0, boundary);
        const separator = buffer.slice(boundary).match(/^\r?\n\r?\n/)?.[0] ?? "\n\n";
        buffer = buffer.slice(boundary + separator.length);
        processEvent(event);
        boundary = buffer.search(/\r?\n\r?\n/);
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) processEvent(buffer);
  } finally {
    reader.releaseLock();
  }

  if (!hasContent) {
    throw new UpstreamFailure("Модель вернула пустой ответ", true, 502);
  }
  if (!isDone) {
    throw new UpstreamFailure("Поток модели оборвался до завершения", true, 502);
  }
}

export function createOpenRouterStream({
  apiKey,
  appUrl,
  model,
  messages,
  signal,
  allowFallback = true,
  fetchImpl = fetch,
  firstTokenTimeoutMs = DEFAULT_FIRST_TOKEN_TIMEOUT_MS,
  idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
  overallTimeoutMs = DEFAULT_OVERALL_TIMEOUT_MS,
  retryBaseDelayMs = DEFAULT_RETRY_BASE_DELAY_MS,
}: StreamOptions) {
  const encoder = new TextEncoder();
  const attachmentKinds = getAttachmentKinds(messages);
  const hasImage = attachmentKinds.includes("image");
  const hasVideo = attachmentKinds.includes("video");
  const route = resolveModelRoute({
    selectedModelId: model,
    attachmentKinds,
    allowFallback,
  });
  const operationStartedAt = Date.now();
  const overallDeadline = operationStartedAt + overallTimeoutMs;
  const preparedMessages: OpenRouterMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...prepareOpenRouterMessages(messages),
  ];
  let activeAttempt: AbortController | null = null;
  let canceled = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: ChatStreamEvent) => {
        if (!canceled) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      void (async () => {
        let hasPartialContent = false;
        let lastFailure: unknown;
        const primaryModel = route.candidates[0];

        diagnostic("info", "route", {
          selectedModel: model,
          routeMode: route.mode,
          hasImage,
          hasVideo,
          allowFallback,
          candidates: route.candidates,
          overallTimeoutMs,
        });

        try {
          send({ type: "status", phase: "sending", message: "Отправка запроса..." });

          if (!primaryModel) {
            throw new UpstreamFailure(
              "Нет совместимой модели для этого типа вложения",
              false,
              400,
            );
          }

          for (let modelIndex = 0; modelIndex < route.candidates.length; modelIndex += 1) {
            const candidateModel = route.candidates[modelIndex];

            if (modelIndex > 0) {
              send({
                type: "fallback",
                fromModel: primaryModel,
                toModel: candidateModel,
              });
              send({
                type: "status",
                phase: "fallback",
                message: "Переключаемся на резервную модель...",
                model: candidateModel,
              });
              diagnostic("warn", "fallback", {
                selectedModel: model,
                fromModel: primaryModel,
                toModel: candidateModel,
              });
            }

            for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_MODEL; attempt += 1) {
              if (Date.now() >= overallDeadline) {
                lastFailure = new UpstreamFailure(
                  "Истёк общий таймаут запроса",
                  true,
                  408,
                );
                break;
              }

              if (attempt > 0) {
                send({
                  type: "status",
                  phase: "retrying",
                  message: `Пробуем повторно... (${attempt + 1}/${MAX_ATTEMPTS_PER_MODEL})`,
                  model: candidateModel,
                });
              } else {
                send({
                  type: "status",
                  phase: "processing",
                  message: hasVideo
                    ? "Модель обрабатывает видео..."
                    : hasImage
                      ? "Модель обрабатывает изображение..."
                      : "Модель обрабатывает запрос...",
                  model: candidateModel,
                });
              }

              const attemptController = new AbortController();
              activeAttempt = attemptController;
              const unlinkAbort = linkAbortSignal(signal, attemptController);
              const startedAt = Date.now();
              let didReportSlowResponse = false;
              const slowResponseTimer = setTimeout(() => {
                didReportSlowResponse = true;
                send({
                  type: "status",
                  phase: "slow",
                  message: "Ответ идёт медленно, продолжаем ждать...",
                  model: candidateModel,
                });
              }, SLOW_RESPONSE_NOTICE_MS);

              diagnostic("info", "attempt", {
                selectedModel: model,
                candidateModel,
                routeMode: route.mode,
                attempt: attempt + 1,
                hasImage,
                hasVideo,
              });

              try {
                const firstTokenDeadline = Math.min(
                  overallDeadline,
                  startedAt + firstTokenTimeoutMs,
                );
                const response = await withDeadline(
                  fetchImpl(OPENROUTER_URL, {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${apiKey}`,
                      "Content-Type": "application/json",
                      "HTTP-Referer": appUrl,
                      "X-Title": "Hermes",
                    },
                    body: JSON.stringify({
                      model: candidateModel,
                      messages: preparedMessages,
                      stream: true,
                      max_tokens: 4096,
                      provider: { allow_fallbacks: true },
                    }),
                    cache: "no-store",
                    signal: attemptController.signal,
                  }),
                  firstTokenDeadline,
                  attemptController,
                  "OpenRouter не подключился вовремя",
                );

                if (!response.ok) {
                  const details = await withDeadline(
                    readError(response),
                    overallDeadline,
                    attemptController,
                    "OpenRouter не вернул описание ошибки вовремя",
                  );
                  throw new UpstreamFailure(
                    details?.message || `OpenRouter вернул ${response.status}`,
                    isRetryableStatus(response.status),
                    response.status,
                  );
                }

                let responseModel = candidateModel;
                await consumeSse(response, {
                  attemptController,
                  firstTokenDeadline,
                  overallDeadline,
                  idleTimeoutMs,
                  onDelta(content) {
                    hasPartialContent = true;
                    clearTimeout(slowResponseTimer);
                    send({ type: "delta", content });
                  },
                  onModel(nextModel) {
                    if (responseModel !== nextModel) {
                      responseModel = nextModel;
                      send({ type: "model", model: nextModel });
                    }
                  },
                });

                const fallbackFrom = modelIndex > 0 ? primaryModel : undefined;
                send({ type: "done", model: responseModel, fallbackFrom });
                diagnostic("info", "complete", {
                  selectedModel: model,
                  finalModel: responseModel,
                  routeMode: route.mode,
                  fallbackFrom,
                  attemptsForFinalModel: attempt + 1,
                  slowResponse: didReportSlowResponse,
                });
                if (!canceled) controller.close();
                return;
              } catch (error) {
                lastFailure = error;
                if (signal.aborted || canceled) return;

                const retryable =
                  error instanceof UpstreamFailure ? error.retryable : true;
                diagnostic("warn", "attempt_failed", {
                  selectedModel: model,
                  candidateModel,
                  attempt: attempt + 1,
                  retryable,
                  status: error instanceof UpstreamFailure ? error.status : undefined,
                  reason: error instanceof Error ? error.message : "network error",
                  hasPartialContent,
                });

                if (hasPartialContent || !retryable) break;
                if (
                  attempt < MAX_ATTEMPTS_PER_MODEL - 1 &&
                  Date.now() < overallDeadline
                ) {
                  const backoffMs = retryBaseDelayMs * 2 ** attempt;
                  await delay(
                    Math.min(backoffMs, Math.max(0, overallDeadline - Date.now())),
                    signal,
                  );
                  continue;
                }
                break;
              } finally {
                clearTimeout(slowResponseTimer);
                unlinkAbort();
                attemptController.abort();
                activeAttempt = null;
              }
            }

            const retryable =
              lastFailure instanceof UpstreamFailure
                ? lastFailure.retryable
                : true;
            const hasNextFallback = modelIndex < route.candidates.length - 1;
            if (!hasPartialContent && retryable && hasNextFallback) continue;

            send({
              type: "error",
              error: userFacingError(lastFailure, hasPartialContent),
              retryable,
            });
            if (!canceled) controller.close();
            return;
          }

          send({
            type: "error",
            error: userFacingError(lastFailure, hasPartialContent),
            retryable: true,
          });
          if (!canceled) controller.close();
        } catch (error) {
          if (!signal.aborted && !canceled) {
            send({
              type: "error",
              error: userFacingError(error, hasPartialContent),
              retryable:
                error instanceof UpstreamFailure ? error.retryable : true,
            });
            controller.close();
          }
        }
      })();
    },
    cancel() {
      canceled = true;
      activeAttempt?.abort();
    },
  });

  return stream;
}
