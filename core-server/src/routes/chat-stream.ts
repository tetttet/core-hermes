import { Router } from "express";
import type { AppContext } from "../context.js";
import { chatMessage, type ChatMessage } from "../lib/chat-input.js";
import { isSupportedModel, modelAccepts } from "../lib/models.js";
import { cleanString, isUuid } from "../lib/validation.js";
import { guestLimit } from "../middleware/guest-limit.js";
import { persistAssistantMessage, persistUserMessage } from "../services/chat-persistence.js";
import { runOpenRouterStream } from "../services/openrouter.js";

export function chatStreamRouter(context: AppContext) {
  const router = Router();

  router.post(["/", "/stream"], guestLimit(context), async (request, response) => {
    const model = cleanString(request.body?.model, 120);
    const messages = request.body?.messages;
    const allowFallback = request.body?.allowFallback !== false;
    if (
      !model ||
      !isSupportedModel(model) ||
      !Array.isArray(messages) ||
      messages.length < 1 ||
      messages.length > 100 ||
      !messages.every(chatMessage) ||
      messages.at(-1)?.role !== "user" ||
      (request.body?.allowFallback !== undefined &&
        typeof request.body.allowFallback !== "boolean")
    ) {
      response.status(400).json({ error: "Некорректный запрос к модели" });
      return;
    }
    const typedMessages = messages as ChatMessage[];
    const incompatible = typedMessages.some((message) =>
      message.attachments?.some((attachment) => !modelAccepts(model, attachment.kind)),
    );
    if (incompatible) {
      response.status(400).json({ error: "Выбранная модель не поддерживает эти вложения" });
      return;
    }

    const latestUserMessage = typedMessages.at(-1)!;
    const chatId = request.body?.chatId;
    const assistantMessageId = request.body?.assistantMessageId;
    const title = cleanString(request.body?.title, 160) ||
      latestUserMessage.content.replace(/\s+/g, " ").trim().slice(0, 42) ||
      latestUserMessage.attachments?.[0]?.name.slice(0, 42) ||
      "Новый чат";
    if (request.auth && (!isUuid(chatId) || !isUuid(assistantMessageId))) {
      response.status(400).json({
        error: "Для сохранения истории нужны chatId и assistantMessageId",
      });
      return;
    }

    let userPersistence: Promise<void> | undefined;
    if (request.auth) {
      userPersistence = persistUserMessage(context, {
        userId: request.auth.id,
        chatId,
        title,
        modelId: model,
        message: latestUserMessage,
      });
      void userPersistence.catch((error) => {
        context.logger.error({ err: error, chatId }, "user message persistence failed");
      });
    }

    response.status(200);
    response.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("X-Accel-Buffering", "no");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.flushHeaders();

    const controller = new AbortController();
    const abort = () => controller.abort(new Error("client disconnected"));
    request.once("aborted", abort);
    response.once("close", () => {
      if (!response.writableEnded) abort();
    });

    try {
      const result = await runOpenRouterStream({
        config: context.config,
        logger: context.logger,
        model,
        messages: typedMessages,
        allowFallback,
        signal: controller.signal,
        emit(event) {
          if (!response.writableEnded && !response.destroyed) {
            response.write(`${JSON.stringify(event)}\n`);
          }
        },
      });
      response.end();

      if (request.auth && result.content) {
        void Promise.resolve(userPersistence)
          .then(() => persistAssistantMessage(context, {
            userId: request.auth!.id,
            chatId,
            messageId: assistantMessageId,
            content: result.content,
            modelId: result.model,
          }))
          .catch((error) => {
            context.logger.error({ err: error, chatId }, "assistant message persistence failed");
          });
      }
    } catch (error) {
      if (!controller.signal.aborted && !response.writableEnded) {
        context.logger.error({ err: error }, "chat stream failed");
        response.write(`${JSON.stringify({
          type: "error",
          error: "Поток ответа неожиданно прервался",
          retryable: true,
        })}\n`);
        response.end();
      }
    }
  });

  return router;
}
