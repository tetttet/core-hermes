import { Router } from "express";
import type { AppContext } from "../context.js";
import { decodeCursor, encodeCursor } from "../lib/cursor.js";
import { cleanString, isUuid, pageLimit } from "../lib/validation.js";
import { isSupportedModel } from "../lib/models.js";
import { requireAuth } from "../middleware/auth.js";
import { standaloneAttachmentMetadata } from "../lib/chat-input.js";

type ChatRow = {
  id: string;
  title: string;
  model_id: string;
  is_favorite: boolean;
  created_at: Date;
  updated_at: Date;
};

type MessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model_id: string | null;
  has_attachment: boolean;
  attachment_meta: unknown;
  created_at: Date;
};

function serializeChat(row: ChatRow) {
  return {
    id: row.id,
    title: row.title,
    modelId: row.model_id,
    isFavorite: row.is_favorite,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function serializeMessage(row: MessageRow) {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    modelId: row.model_id,
    hasAttachment: row.has_attachment,
    attachmentMeta: row.attachment_meta,
    createdAt: row.created_at.toISOString(),
  };
}

function invalidateChats(context: AppContext, userId: string) {
  for (const key of context.caches.chats.keys()) {
    if (key.startsWith(`${userId}:`)) context.caches.chats.delete(key);
  }
}

export function chatsRouter(context: AppContext) {
  const router = Router();
  router.use(requireAuth);

  router.get("/", async (request, response) => {
    const limit = pageLimit(request.query.limit);
    const hasCursor = request.query.cursor !== undefined;
    const cursor = hasCursor ? decodeCursor(request.query.cursor) : undefined;
    if (!limit || (hasCursor && !cursor)) {
      response.status(400).json({ error: "Некорректная пагинация" });
      return;
    }
    const userId = request.auth!.id;
    const cacheKey = `${userId}:${limit}`;
    if (!cursor) {
      const cached = context.caches.chats.get(cacheKey);
      if (cached) {
        response.json(cached);
        return;
      }
    }

    const result = cursor
      ? await context.database.query<ChatRow>({
          name: "chats-page-after-cursor",
          text: `SELECT id, title, model_id, is_favorite, created_at, updated_at
                 FROM chats
                 WHERE user_id = $1 AND (updated_at, id) < ($2::timestamptz, $3::uuid)
                 ORDER BY updated_at DESC, id DESC
                 LIMIT $4`,
          values: [userId, cursor.at, cursor.id, limit + 1],
        })
      : await context.database.query<ChatRow>({
          name: "chats-first-page",
          text: `SELECT id, title, model_id, is_favorite, created_at, updated_at
                 FROM chats
                 WHERE user_id = $1
                 ORDER BY updated_at DESC, id DESC
                 LIMIT $2`,
          values: [userId, limit + 1],
        });
    const hasMore = result.rows.length > limit;
    const rows = result.rows.slice(0, limit);
    const last = rows.at(-1);
    const payload = {
      items: rows.map(serializeChat),
      nextCursor: hasMore && last
        ? encodeCursor({ at: last.updated_at.toISOString(), id: last.id })
        : null,
    };
    if (!cursor) context.caches.chats.set(cacheKey, payload);
    response.json(payload);
  });

  router.post("/", async (request, response) => {
    const id = request.body?.id === undefined ? undefined : request.body.id;
    const title = cleanString(request.body?.title, 160);
    const modelId = cleanString(request.body?.modelId, 120);
    if ((id !== undefined && !isUuid(id)) || !title || !modelId || !isSupportedModel(modelId)) {
      response.status(400).json({ error: "Некорректный чат" });
      return;
    }
    const userId = request.auth!.id;
    const result = await context.database.query<ChatRow>({
      name: id ? "chat-create-with-id" : "chat-create",
      text: id
        ? `INSERT INTO chats (id, user_id, title, model_id)
           VALUES ($1, $2, $3, $4)
           RETURNING id, title, model_id, is_favorite, created_at, updated_at`
        : `INSERT INTO chats (user_id, title, model_id)
           VALUES ($1, $2, $3)
           RETURNING id, title, model_id, is_favorite, created_at, updated_at`,
      values: id ? [id, userId, title, modelId] : [userId, title, modelId],
    });
    invalidateChats(context, userId);
    response.status(201).json({ chat: serializeChat(result.rows[0]!) });
  });

  router.patch("/:chatId", async (request, response) => {
    const chatId = request.params.chatId;
    const title = request.body?.title === undefined
      ? undefined
      : cleanString(request.body.title, 160);
    const modelId = request.body?.modelId === undefined
      ? undefined
      : cleanString(request.body.modelId, 120);
    const isFavorite = request.body?.isFavorite === undefined
      ? undefined
      : request.body.isFavorite;
    if (
      !isUuid(chatId) ||
      (title === undefined && modelId === undefined && isFavorite === undefined) ||
      (request.body?.title !== undefined && !title) ||
      (request.body?.modelId !== undefined && (!modelId || !isSupportedModel(modelId))) ||
      (isFavorite !== undefined && typeof isFavorite !== "boolean")
    ) {
      response.status(400).json({ error: "Некорректное изменение чата" });
      return;
    }
    const userId = request.auth!.id;
    const result = await context.database.query<ChatRow>({
      name: "chat-update",
      text: `UPDATE chats
             SET title = COALESCE($3, title),
                 model_id = COALESCE($4, model_id),
                 is_favorite = COALESCE($5, is_favorite)
             WHERE id = $1 AND user_id = $2
             RETURNING id, title, model_id, is_favorite, created_at, updated_at`,
      values: [chatId, userId, title ?? null, modelId ?? null, isFavorite ?? null],
    });
    const chat = result.rows[0];
    if (!chat) {
      response.status(404).json({ error: "Чат не найден" });
      return;
    }
    invalidateChats(context, userId);
    response.json({ chat: serializeChat(chat) });
  });

  router.delete("/:chatId", async (request, response) => {
    const chatId = request.params.chatId;
    if (!isUuid(chatId)) {
      response.status(400).json({ error: "Некорректный id чата" });
      return;
    }
    const userId = request.auth!.id;
    const result = await context.database.query({
      name: "chat-delete",
      text: "DELETE FROM chats WHERE id = $1 AND user_id = $2 RETURNING id",
      values: [chatId, userId],
    });
    if (!result.rowCount) {
      response.status(404).json({ error: "Чат не найден" });
      return;
    }
    invalidateChats(context, userId);
    response.status(204).end();
  });

  router.get("/:chatId/messages", async (request, response) => {
    const chatId = request.params.chatId;
    const limit = pageLimit(request.query.limit, 50, 100);
    const hasCursor = request.query.cursor !== undefined;
    const cursor = hasCursor ? decodeCursor(request.query.cursor) : undefined;
    if (!isUuid(chatId) || !limit || (hasCursor && !cursor)) {
      response.status(400).json({ error: "Некорректная пагинация" });
      return;
    }
    const userId = request.auth!.id;
    const result = cursor
      ? await context.database.query<MessageRow>({
          name: "messages-page-after-cursor",
          text: `SELECT m.id, m.role, m.content, m.model_id, m.has_attachment,
                        m.attachment_meta, m.created_at
                 FROM messages m
                 JOIN chats c ON c.id = m.chat_id
                 WHERE m.chat_id = $1 AND c.user_id = $2
                   AND (m.created_at, m.id) < ($3::timestamptz, $4::uuid)
                 ORDER BY m.created_at DESC, m.id DESC
                 LIMIT $5`,
          values: [chatId, userId, cursor.at, cursor.id, limit + 1],
        })
      : await context.database.query<MessageRow>({
          name: "messages-first-page",
          text: `SELECT m.id, m.role, m.content, m.model_id, m.has_attachment,
                        m.attachment_meta, m.created_at
                 FROM messages m
                 JOIN chats c ON c.id = m.chat_id
                 WHERE m.chat_id = $1 AND c.user_id = $2
                 ORDER BY m.created_at DESC, m.id DESC
                 LIMIT $3`,
          values: [chatId, userId, limit + 1],
        });
    const hasMore = result.rows.length > limit;
    const descendingRows = result.rows.slice(0, limit);
    const oldest = descendingRows.at(-1);
    response.json({
      items: descendingRows.reverse().map(serializeMessage),
      nextCursor: hasMore && oldest
        ? encodeCursor({ at: oldest.created_at.toISOString(), id: oldest.id })
        : null,
    });
  });

  router.post("/:chatId/messages", async (request, response) => {
    const chatId = request.params.chatId;
    const id = request.body?.id;
    const role = request.body?.role;
    const content = typeof request.body?.content === "string" ? request.body.content : undefined;
    const modelId = request.body?.modelId === undefined
      ? undefined
      : cleanString(request.body.modelId, 120);
    const metadata = standaloneAttachmentMetadata(request.body?.attachmentMeta);
    if (
      !isUuid(chatId) ||
      !isUuid(id) ||
      (role !== "user" && role !== "assistant") ||
      content === undefined ||
      content.length > 80_000 ||
      metadata === null ||
      (modelId !== undefined && !isSupportedModel(modelId)) ||
      (!content.trim() && !metadata)
    ) {
      response.status(400).json({ error: "Некорректное сообщение" });
      return;
    }
    const result = await context.database.query<MessageRow>({
      name: "message-create",
      text: `INSERT INTO messages
               (id, chat_id, role, content, model_id, has_attachment, attachment_meta)
             SELECT $1, c.id, $4, $5, $6, $7, $8::jsonb
             FROM chats c
             WHERE c.id = $2 AND c.user_id = $3
             RETURNING id, role, content, model_id, has_attachment, attachment_meta, created_at`,
      values: [
        id,
        chatId,
        request.auth!.id,
        role,
        content,
        modelId ?? null,
        Boolean(metadata),
        metadata ? JSON.stringify(metadata) : null,
      ],
    });
    const message = result.rows[0];
    if (!message) {
      response.status(404).json({ error: "Чат не найден" });
      return;
    }
    invalidateChats(context, request.auth!.id);
    response.status(201).json({ message: serializeMessage(message) });
  });

  return router;
}
