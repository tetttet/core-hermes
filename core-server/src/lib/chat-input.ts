import { cleanString, isUuid } from "./validation.js";

export type AttachmentKind = "image" | "video";

export type ChatAttachment = {
  id: string;
  name: string;
  kind: AttachmentKind;
  mimeType: string;
  size: number;
  dataUrl?: string;
  videoFrames?: string[];
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: ChatAttachment[];
};

const MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/mpeg",
  "video/quicktime",
  "video/webm",
]);

function attachment(value: unknown): value is ChatAttachment {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ChatAttachment>;
  const mimeType = typeof item.mimeType === "string" ? item.mimeType : "";
  const kindMatches =
    (item.kind === "image" && mimeType.startsWith("image/")) ||
    (item.kind === "video" && mimeType.startsWith("video/"));
  const dataUrlValid =
    item.dataUrl === undefined ||
    (typeof item.dataUrl === "string" &&
      item.dataUrl.length <= 4_300_000 &&
      item.dataUrl.startsWith(`data:${mimeType};base64,`));
  const framesValid =
    item.videoFrames === undefined ||
    (item.kind === "video" &&
      Array.isArray(item.videoFrames) &&
      item.videoFrames.length >= 1 &&
      item.videoFrames.length <= 4 &&
      item.videoFrames.every(
        (frame) =>
          typeof frame === "string" &&
          frame.length <= 600_000 &&
          frame.startsWith("data:image/jpeg;base64,"),
      ));
  return (
    isUuid(item.id) &&
    Boolean(cleanString(item.name, 240)) &&
    (item.kind === "image" || item.kind === "video") &&
    MIME_TYPES.has(mimeType) &&
    kindMatches &&
    typeof item.size === "number" &&
    Number.isFinite(item.size) &&
    item.size >= 0 &&
    item.size <= 3 * 1_024 * 1_024 &&
    dataUrlValid &&
    framesValid
  );
}

export function chatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<ChatMessage> & { status?: unknown };
  return (
    isUuid(message.id) &&
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string" &&
    message.content.length <= (message.role === "user" ? 20_000 : 80_000) &&
    message.status === undefined &&
    (message.attachments === undefined ||
      (message.role === "user" &&
        Array.isArray(message.attachments) &&
        message.attachments.length <= 4 &&
        message.attachments.every(attachment))) &&
    (message.content.trim().length > 0 || Boolean(message.attachments?.length))
  );
}

export function attachmentMetadata(attachments: ChatAttachment[] | undefined) {
  return attachments?.map(({ id, name, kind, mimeType, size }) => ({
    id,
    name,
    kind,
    mimeType,
    size,
  }));
}

export function standaloneAttachmentMetadata(value: unknown) {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length < 1 || value.length > 4) return null;
  const result = value.map((item) => {
    if (!item || typeof item !== "object") return undefined;
    const candidate = item as Record<string, unknown>;
    const id = isUuid(candidate.id) ? candidate.id : undefined;
    const name = cleanString(candidate.name, 240);
    const kind = candidate.kind === "image" ||
      candidate.kind === "video" ||
      candidate.kind === "document"
      ? candidate.kind
      : undefined;
    const mimeType = cleanString(candidate.mimeType, 120);
    const size = typeof candidate.size === "number" && candidate.size >= 0
      ? candidate.size
      : undefined;
    return id && name && kind && mimeType && size !== undefined
      ? { id, name, kind, mimeType, size }
      : undefined;
  });
  return result.every(Boolean) ? result : null;
}
