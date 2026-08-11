import type { AppContext } from "../context.js";
import { attachmentMetadata, type ChatMessage } from "../lib/chat-input.js";

export type PersistRequest = {
  userId: string;
  chatId: string;
  title: string;
  modelId: string;
  message: ChatMessage;
};

export async function persistUserMessage(context: AppContext, input: PersistRequest) {
  const metadata = attachmentMetadata(input.message.attachments);
  const result = await context.database.query({
    name: "stream-user-message-persist",
    text: `WITH owned_chat AS (
             INSERT INTO chats (id, user_id, title, model_id)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (id) DO UPDATE SET model_id = EXCLUDED.model_id
             WHERE chats.user_id = EXCLUDED.user_id
             RETURNING id
           )
           INSERT INTO messages
             (id, chat_id, role, content, has_attachment, attachment_meta)
           SELECT $5, id, 'user', $6, $7, $8::jsonb FROM owned_chat
           ON CONFLICT (id) DO NOTHING
           RETURNING id`,
    values: [
      input.chatId,
      input.userId,
      input.title,
      input.modelId,
      input.message.id,
      input.message.content,
      Boolean(metadata?.length),
      metadata?.length ? JSON.stringify(metadata) : null,
    ],
  });
  if (!result.rowCount) {
    const existing = await context.database.query({
      name: "stream-message-idempotency-check",
      text: `SELECT m.id
             FROM messages m
             JOIN chats c ON c.id = m.chat_id
             WHERE m.id = $1 AND m.chat_id = $2 AND c.user_id = $3`,
      values: [input.message.id, input.chatId, input.userId],
    });
    if (!existing.rowCount) throw new Error("chat or message does not belong to user");
  }
  invalidateUserChats(context, input.userId);
}

export async function persistAssistantMessage(
  context: AppContext,
  input: {
    userId: string;
    chatId: string;
    messageId: string;
    content: string;
    modelId: string;
  },
) {
  await context.database.query({
    name: "stream-assistant-message-insert",
    text: `INSERT INTO messages (id, chat_id, role, content, model_id)
           SELECT $1, c.id, 'assistant', $4, $5
           FROM chats c
           WHERE c.id = $2 AND c.user_id = $3
           ON CONFLICT (id) DO UPDATE SET
             content = EXCLUDED.content,
             model_id = EXCLUDED.model_id
           WHERE messages.chat_id = EXCLUDED.chat_id`,
    values: [input.messageId, input.chatId, input.userId, input.content, input.modelId],
  });
  invalidateUserChats(context, input.userId);
}

function invalidateUserChats(context: AppContext, userId: string) {
  for (const key of context.caches.chats.keys()) {
    if (key.startsWith(`${userId}:`)) context.caches.chats.delete(key);
  }
}
