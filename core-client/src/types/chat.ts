export type ChatRole = "user" | "assistant";

export type ChatAttachment = {
  id: string;
  name: string;
  kind: "image" | "video";
  mimeType: string;
  dataUrl: string;
  size: number;
  videoFrames?: string[];
};

export type ChatRequestAttachment = Omit<ChatAttachment, "dataUrl"> & {
  dataUrl?: string;
};

export type ChatAttachmentMeta = Pick<
  ChatAttachment,
  "id" | "name" | "mimeType" | "size"
> & { kind: ChatAttachment["kind"] | "document" };

export type RemoteChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  modelId: string | null;
  hasAttachment: boolean;
  attachmentMeta: ChatAttachmentMeta[] | null;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  attachments?: ChatAttachment[];
  status?: "streaming" | "error";
  modelId?: string;
  notice?: string;
};

export type ChatRequestMessage = Omit<
  ChatMessage,
  "attachments" | "status" | "modelId"
> & {
  attachments?: ChatRequestAttachment[];
};

export type ChatThread = {
  id: string;
  title: string;
  modelId: string;
  messages: ChatMessage[];
  isFavorite?: boolean;
  isSynced?: boolean;
  createdAt: number;
  updatedAt: number;
};

export type ChatStore = {
  activeChatId: string | null;
  draftModelId: string;
  chats: ChatThread[];
};
