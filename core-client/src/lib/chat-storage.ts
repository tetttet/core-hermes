import { DEFAULT_MODEL_ID, isSupportedModel, modelAccepts } from "@/config/models";
import type {
  ChatAttachment,
  ChatMessage,
  RemoteChatMessage,
  ChatStore,
  ChatThread,
} from "@/types/chat";

const STORAGE_KEY = "hermes-chat";
const CHANGE_EVENT = "hermes-chat-change";
const EMPTY_STORE: ChatStore = {
  activeChatId: null,
  draftModelId: DEFAULT_MODEL_ID,
  chats: [],
};

let cachedRaw: string | null | undefined;
let cachedStore: ChatStore = EMPTY_STORE;

function isAttachment(value: unknown): value is ChatAttachment {
  if (!value || typeof value !== "object") return false;

  const attachment = value as Partial<ChatAttachment>;
  return (
    typeof attachment.id === "string" &&
    typeof attachment.name === "string" &&
    (attachment.kind === "image" || attachment.kind === "video") &&
    typeof attachment.mimeType === "string" &&
    typeof attachment.dataUrl === "string" &&
    attachment.dataUrl.startsWith(`data:${attachment.mimeType};base64,`) &&
    typeof attachment.size === "number" &&
    (attachment.videoFrames === undefined ||
      (attachment.kind === "video" &&
        Array.isArray(attachment.videoFrames) &&
        attachment.videoFrames.length > 0 &&
        attachment.videoFrames.length <= 4 &&
        attachment.videoFrames.every(
          (frame) =>
            typeof frame === "string" &&
            frame.startsWith("data:image/jpeg;base64,"),
        )))
  );
}

function isMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;

  const message = value as Partial<ChatMessage>;
  return (
    typeof message.id === "string" &&
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string" &&
    (message.createdAt === undefined ||
      (typeof message.createdAt === "number" &&
        Number.isFinite(message.createdAt))) &&
    (message.modelId === undefined || typeof message.modelId === "string") &&
    (message.notice === undefined || typeof message.notice === "string") &&
    (message.status === undefined ||
      message.status === "streaming" ||
      message.status === "error") &&
    (message.attachments === undefined ||
      (Array.isArray(message.attachments) &&
        message.attachments.every(isAttachment)))
  );
}

function isThread(value: unknown): value is ChatThread {
  if (!value || typeof value !== "object") return false;

  const thread = value as Partial<ChatThread>;
  return (
    typeof thread.id === "string" &&
    typeof thread.title === "string" &&
    typeof thread.modelId === "string" &&
    isSupportedModel(thread.modelId) &&
    Array.isArray(thread.messages) &&
    thread.messages.every(isMessage) &&
    (thread.ownerUserId === undefined ||
      typeof thread.ownerUserId === "string") &&
    (thread.messagesLoaded === undefined ||
      typeof thread.messagesLoaded === "boolean") &&
    (thread.isFavorite === undefined ||
      typeof thread.isFavorite === "boolean") &&
    (thread.isSynced === undefined ||
      typeof thread.isSynced === "boolean") &&
    typeof thread.createdAt === "number" &&
    typeof thread.updatedAt === "number"
  );
}

function migrateLegacyChat(value: Record<string, unknown>): ChatStore | null {
  if (
    typeof value.modelId !== "string" ||
    !isSupportedModel(value.modelId) ||
    !Array.isArray(value.messages)
  ) {
    return null;
  }

  const messages = value.messages.filter(isMessage);
  if (messages.length === 0) {
    return { ...EMPTY_STORE, draftModelId: value.modelId };
  }

  const firstUserMessage = messages.find((message) => message.role === "user");
  const now = Date.now();
  const thread: ChatThread = {
    id: `legacy-${now}`,
    title: firstUserMessage?.content.slice(0, 42) || "Старый чат",
    modelId: value.modelId,
    messages,
    createdAt: now,
    updatedAt: now,
  };

  return {
    activeChatId: thread.id,
    draftModelId: DEFAULT_MODEL_ID,
    chats: [thread],
  };
}

function parseStore(raw: string | null): ChatStore {
  if (!raw) return EMPTY_STORE;

  try {
    const saved = JSON.parse(raw) as Record<string, unknown>;
    if (!Array.isArray(saved.chats)) {
      return migrateLegacyChat(saved) ?? EMPTY_STORE;
    }

    const chats = saved.chats.filter(isThread).map((thread) => ({
      ...thread,
      messages: thread.messages.map((message) => ({
        ...message,
        status: message.status === "streaming" ? "error" : message.status,
        attachments: message.attachments?.filter((attachment) =>
          modelAccepts(thread.modelId, attachment.kind),
        ),
      })),
    }));
    const activeChatId =
      typeof saved.activeChatId === "string" &&
      chats.some((chat) => chat.id === saved.activeChatId)
        ? saved.activeChatId
        : null;

    return {
      activeChatId,
      draftModelId:
        typeof saved.draftModelId === "string" &&
        isSupportedModel(saved.draftModelId)
          ? saved.draftModelId
          : DEFAULT_MODEL_ID,
      chats,
    };
  } catch {
    return EMPTY_STORE;
  }
}

export function getChatSnapshot(): ChatStore {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedStore = parseStore(raw);
  }
  return cachedStore;
}

export function getChatServerSnapshot(): ChatStore {
  return EMPTY_STORE;
}

export function subscribeToChat(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

export function saveChatStore(store: ChatStore) {
  try {
    const raw = JSON.stringify(store);
    window.localStorage.setItem(STORAGE_KEY, raw);
    cachedRaw = raw;
    cachedStore = store;
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function clearChatStore() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    cachedRaw = null;
    cachedStore = EMPTY_STORE;
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function isAccountChat(thread: ChatThread) {
  return Boolean(thread.ownerUserId || thread.isSynced);
}

export function clearAccountChats() {
  const store = getChatSnapshot();
  const chats = store.chats.filter((chat) => !isAccountChat(chat));

  if (chats.length === store.chats.length) return true;
  if (chats.length === 0) return clearChatStore();

  return saveChatStore({
    ...store,
    activeChatId:
      store.activeChatId && chats.some((chat) => chat.id === store.activeChatId)
        ? store.activeChatId
        : null,
    chats,
  });
}

const REMOTE_FILE_PLACEHOLDER =
  "Этот файл был обработан на другом устройстве. Откройте чат с того устройства, чтобы увидеть файл";

export function mergeRemoteMessages(
  remoteMessages: RemoteChatMessage[],
  localMessages: ChatMessage[] = [],
): ChatMessage[] {
  const localById = new Map(localMessages.map((message) => [message.id, message]));

  return remoteMessages.map((remote): ChatMessage => {
    const local = localById.get(remote.id);
    const metadata = remote.attachmentMeta ?? [];
    const metadataIds = new Set(metadata.map((attachment) => attachment.id));
    const attachments = local?.attachments?.filter((attachment) =>
      metadataIds.has(attachment.id),
    );
    const hasMissingAttachment =
      remote.hasAttachment && (attachments?.length ?? 0) < metadata.length;
    const content = hasMissingAttachment
      ? [remote.content, `> ${REMOTE_FILE_PLACEHOLDER}`].filter(Boolean).join("\n\n")
      : remote.content;
    const remoteCreatedAt = Date.parse(remote.createdAt);

    return {
      id: remote.id,
      role: remote.role,
      content,
      ...(Number.isFinite(remoteCreatedAt)
        ? { createdAt: remoteCreatedAt }
        : local?.createdAt !== undefined
          ? { createdAt: local.createdAt }
          : {}),
      ...(attachments?.length ? { attachments } : {}),
      ...(remote.modelId ? { modelId: remote.modelId } : {}),
    };
  });
}
