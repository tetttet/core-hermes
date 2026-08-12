"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  PaperclipIcon,
  SendIcon,
  StopIcon,
  XIcon,
} from "@/components/icons";
import { AUTO_MODEL_ID, getModel } from "@/config/models";
import type { ChatAttachment } from "@/types/chat";
import { ModelSelector } from "./model-selector";
import Image from "next/image";

const MAX_ATTACHMENTS = 4;
const MAX_TOTAL_SIZE = 3 * 1024 * 1024;
const VIDEO_FRAME_COUNT = 4;
const VIDEO_FRAME_MAX_EDGE = 640;
const ATTACHMENT_REMOVE_DURATION = 220;

const SUPPORTED_MEDIA_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/mpeg",
  "video/quicktime",
  "video/webm",
];

const TEXT_PLACEHOLDERS = [
  "Напишите сообщение Hermes",
  "Задайте вопрос выбранной модели",
  "Опишите задачу, которую нужно решить",
];

const MEDIA_PLACEHOLDERS = [
  "Напишите сообщение Hermes",
  "Перетащите фото или видео сюда",
  "Прикрепите изображение для анализа",
  "Спросите что-нибудь о файле",
];

type ChatComposerProps = {
  modelId: string;
  modelLocked: boolean;
  onModelChange: (modelId: string) => void;
  onSend: (message: string, attachments: ChatAttachment[]) => void;
  onStop: () => void;
  isLoading: boolean;
  disabled?: boolean;
};

type AttachmentCardProps = {
  attachment: ChatAttachment;
  isRemoving: boolean;
  disabled: boolean;
  onRemove: (id: string) => void;
  onPreview: (attachment: ChatAttachment) => void;
};

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(file);
  });
}

function waitForVideoEvent(
  video: HTMLVideoElement,
  eventName: "loadeddata" | "seeked",
  timeoutMs = 15_000,
) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      video.removeEventListener(eventName, handleEvent);
      video.removeEventListener("error", handleError);
    };

    const handleEvent = () => {
      cleanup();
      resolve();
    };

    const handleError = () => {
      cleanup();
      reject(new Error("Браузер не смог декодировать видео"));
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Подготовка видео заняла слишком много времени"));
    }, timeoutMs);

    video.addEventListener(eventName, handleEvent, { once: true });
    video.addEventListener("error", handleError, { once: true });
  });
}

async function seekVideo(video: HTMLVideoElement, time: number) {
  if (Math.abs(video.currentTime - time) < 0.01) return;

  const seeked = waitForVideoEvent(video, "seeked");
  video.currentTime = time;
  await seeked;
}

async function extractVideoFrames(file: File) {
  const video = document.createElement("video");
  const objectUrl = URL.createObjectURL(file);

  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";

  try {
    video.src = objectUrl;
    video.load();

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      await waitForVideoEvent(video, "loadeddata");
    }

    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      throw new Error("Не удалось определить длительность видео");
    }

    const scale = Math.min(
      1,
      VIDEO_FRAME_MAX_EDGE / Math.max(video.videoWidth, video.videoHeight),
    );

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Не удалось подготовить кадры видео");

    const lastTime = Math.max(0, video.duration - 0.05);
    const times = Array.from(
      { length: VIDEO_FRAME_COUNT },
      (_, index) => (lastTime * index) / (VIDEO_FRAME_COUNT - 1),
    );
    const frames: string[] = [];

    for (const time of times) {
      await seekVideo(video, time);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.72));
    }

    return frames;
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}

function hasDraggedFiles(dataTransfer: DataTransfer | null) {
  return Array.from(dataTransfer?.types ?? []).includes("Files");
}

function useAnimatedPlaceholder(acceptsMedia: boolean, paused: boolean) {
  const [placeholder, setPlaceholder] = useState("");

  useEffect(() => {
    const phrases = acceptsMedia ? MEDIA_PLACEHOLDERS : TEXT_PLACEHOLDERS;

    if (paused) {
      const timeoutId = window.setTimeout(() => {
        setPlaceholder("");
      }, 0);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      const timeoutId = window.setTimeout(() => {
        setPlaceholder(phrases[0]);
      }, 0);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }

    let phraseIndex = 0;
    let characterIndex = 0;
    let isDeleting = false;
    let timeoutId = 0;
    let cancelled = false;

    const run = () => {
      if (cancelled) return;

      const phrase = phrases[phraseIndex];

      if (!isDeleting) {
        characterIndex += 1;
        setPlaceholder(phrase.slice(0, characterIndex));

        if (characterIndex >= phrase.length) {
          isDeleting = true;
          timeoutId = window.setTimeout(run, 1_650);
          return;
        }

        timeoutId = window.setTimeout(run, 48 + Math.random() * 28);
        return;
      }

      characterIndex -= 1;
      setPlaceholder(phrase.slice(0, Math.max(0, characterIndex)));

      if (characterIndex <= 0) {
        isDeleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        timeoutId = window.setTimeout(run, 360);
        return;
      }

      timeoutId = window.setTimeout(run, 24 + Math.random() * 18);
    };

    timeoutId = window.setTimeout(run, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [acceptsMedia, paused]);

  return placeholder;
}

function AttachmentCard({
  attachment,
  isRemoving,
  disabled,
  onRemove,
  onPreview,
}: AttachmentCardProps) {
  const isVideo = attachment.kind === "video";

  return (
    <div
      className={`attachment-card group relative size-[76px] shrink-0 overflow-hidden rounded-2xl border shadow-sm ${
        isRemoving ? "attachment-card--removing" : ""
      }`}
    >
      <button
        type="button"
        disabled={disabled || isRemoving}
        onClick={() => onPreview(attachment)}
        aria-label={`Открыть ${attachment.name}`}
        title="Открыть файл"
        className="relative block size-full overflow-hidden bg-black/5 outline-none disabled:cursor-not-allowed"
      >
        {isVideo ? (
          <>
            <video
              src={attachment.dataUrl}
              muted
              playsInline
              preload="metadata"
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.04]"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/10">
              <span className="flex size-7 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
                <span className="ml-0.5 h-0 w-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-current" />
              </span>
            </span>
          </>
        ) : (
          <Image
            src={attachment.dataUrl}
            alt={attachment.name}
            fill
            unoptimized
            sizes="76px"
            className="object-cover transition-transform duration-200 group-hover:scale-[1.04]"
          />
        )}
      </button>

      <button
        type="button"
        disabled={disabled || isRemoving}
        onClick={() => onRemove(attachment.id)}
        aria-label={`Удалить ${attachment.name}`}
        title="Удалить файл"
        className="attachment-remove absolute right-1 top-1 z-10 flex size-6 items-center justify-center rounded-full text-white shadow-sm backdrop-blur-md transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        <XIcon className="size-3.5" />
      </button>
    </div>
  );
}

function AttachmentViewer({
  attachment,
  onClose,
}: {
  attachment: ChatAttachment;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Просмотр ${attachment.name}`}
      className="attachment-viewer fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-8"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Закрыть просмотр"
        className="attachment-viewer-close absolute right-4 top-4 z-10 flex size-10 items-center justify-center rounded-full text-white backdrop-blur-md transition hover:scale-105 sm:right-6 sm:top-6"
      >
        <XIcon className="size-5" />
      </button>
      <div
        className="relative h-[min(82vh,760px)] w-[min(92vw,1080px)] overflow-hidden rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {attachment.kind === "image" ? (
          <Image
            src={attachment.dataUrl}
            alt={attachment.name}
            fill
            unoptimized
            sizes="92vw"
            priority
            className="object-contain"
          />
        ) : (
          <video
            src={attachment.dataUrl}
            controls
            autoPlay
            playsInline
            className="size-full object-contain"
          />
        )}
      </div>
    </div>
  );
}

export function ChatComposer({
  modelId,
  modelLocked,
  onModelChange,
  onSend,
  onStop,
  isLoading,
  disabled = false,
}: ChatComposerProps) {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [removingAttachmentIds, setRemovingAttachmentIds] = useState<string[]>(
    [],
  );
  const [fileError, setFileError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [previewAttachment, setPreviewAttachment] =
    useState<ChatAttachment | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const removalTimersRef = useRef(new Map<string, number>());
  const processFilesRef = useRef<(files: File[]) => Promise<void>>(
    async () => {},
  );

  const model = getModel(modelId);
  const acceptsMedia = model.supportsVision || model.supportsVideo;
  const acceptedMediaTypes = SUPPORTED_MEDIA_TYPES.filter((mimeType) =>
    mimeType.startsWith("image/") ? model.supportsVision : model.supportsVideo,
  );
  const canAttachMedia = acceptsMedia || !modelLocked;
  const inputAcceptedMediaTypes = acceptsMedia
    ? acceptedMediaTypes
    : SUPPORTED_MEDIA_TYPES;

  const hasValue = value.length > 0;
  const animatedPlaceholder = useAnimatedPlaceholder(acceptsMedia, hasValue);
  const controlsDisabled = isLoading || disabled;
  const canSend =
    (value.trim().length > 0 || attachments.length > 0) &&
    !controlsDisabled &&
    !isProcessingFiles;

  useEffect(() => {
    const removalTimers = removalTimersRef.current;

    return () => {
      for (const timer of removalTimers.values()) {
        window.clearTimeout(timer);
      }
      removalTimers.clear();
    };
  }, []);

  useEffect(() => {
    if (!previewAttachment) return;

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setPreviewAttachment(null);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [previewAttachment]);

  useEffect(() => {
    const handleDragEnter = (event: globalThis.DragEvent) => {
      if (!hasDraggedFiles(event.dataTransfer)) return;

      event.preventDefault();
      dragDepthRef.current += 1;
      if (!controlsDisabled && !isProcessingFiles) setIsDragging(true);
    };

    const handleDragOver = (event: globalThis.DragEvent) => {
      if (!hasDraggedFiles(event.dataTransfer)) return;

      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    };

    const handleDragLeave = (event: globalThis.DragEvent) => {
      if (dragDepthRef.current === 0) return;

      event.preventDefault();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) setIsDragging(false);
    };

    const handleDrop = (event: globalThis.DragEvent) => {
      if (!hasDraggedFiles(event.dataTransfer)) return;

      event.preventDefault();
      dragDepthRef.current = 0;
      setIsDragging(false);

      if (!controlsDisabled && !isProcessingFiles) {
        void processFilesRef.current(
          Array.from(event.dataTransfer?.files ?? []),
        );
      }
    };

    const handleDragEnd = () => {
      dragDepthRef.current = 0;
      setIsDragging(false);
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);
    window.addEventListener("dragend", handleDragEnd);
    window.addEventListener("blur", handleDragEnd);
    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
      window.removeEventListener("dragend", handleDragEnd);
      window.removeEventListener("blur", handleDragEnd);
    };
  }, [controlsDisabled, isProcessingFiles]);

  function clearRemovalTimers() {
    for (const timer of removalTimersRef.current.values()) {
      window.clearTimeout(timer);
    }
    removalTimersRef.current.clear();
    setRemovingAttachmentIds([]);
  }

  function resetComposer() {
    clearRemovalTimers();
    setValue("");
    setAttachments([]);
    setFileError("");
    setIsDragging(false);
    dragDepthRef.current = 0;

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function submit() {
    if (!canSend) return;

    onSend(value.trim(), attachments);
    resetComposer();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  async function processFiles(files: File[]) {
    if (files.length === 0 || isProcessingFiles) return;

    setFileError("");

    let attachmentModel = model;
    let shouldSwitchToAuto = false;

    if (!acceptsMedia) {
      if (modelLocked) {
        setFileError("Выбранная модель не поддерживает изображения и видео");
        return;
      }

      attachmentModel = getModel(AUTO_MODEL_ID);
      shouldSwitchToAuto = true;
    }

    if (attachments.length + files.length > MAX_ATTACHMENTS) {
      setFileError(`Можно прикрепить максимум ${MAX_ATTACHMENTS} файла`);
      return;
    }

    const attachmentMediaTypes = SUPPORTED_MEDIA_TYPES.filter((mimeType) =>
      mimeType.startsWith("image/")
        ? attachmentModel.supportsVision
        : attachmentModel.supportsVideo,
    );
    const supportedFiles = files.filter((file) =>
      attachmentMediaTypes.includes(file.type),
    );

    if (supportedFiles.length !== files.length) {
      setFileError(
        attachmentModel.supportsVideo
          ? "Поддерживаются только изображения и видео"
          : "Выбранная модель поддерживает только изображения",
      );
      return;
    }

    const currentTotalSize = attachments.reduce(
      (sum, attachment) => sum + attachment.size,
      0,
    );
    const newFilesSize = supportedFiles.reduce(
      (sum, file) => sum + file.size,
      0,
    );

    if (currentTotalSize + newFilesSize > MAX_TOTAL_SIZE) {
      setFileError("Общий размер вложений — не больше 3 МБ");
      return;
    }

    if (shouldSwitchToAuto) onModelChange(AUTO_MODEL_ID);
    setIsProcessingFiles(true);

    try {
      let hasVideoFrameWarning = false;

      const nextAttachments = await Promise.all(
        supportedFiles.map(async (file): Promise<ChatAttachment> => {
          const isVideo = file.type.startsWith("video/");
          let videoFrames: string[] | undefined;

          if (isVideo) {
            try {
              videoFrames = await extractVideoFrames(file);
            } catch {
              hasVideoFrameWarning = true;
            }
          }

          return {
            id: crypto.randomUUID(),
            name: file.name,
            kind: isVideo ? "video" : "image",
            mimeType: file.type,
            dataUrl: await readAsDataUrl(file),
            size: file.size,
            videoFrames,
          };
        }),
      );

      setAttachments((current) => [...current, ...nextAttachments]);

      if (hasVideoFrameWarning) {
        setFileError(
          "Не удалось извлечь кадры одного из видео; оно будет отправлено в исходном формате.",
        );
      }
    } catch (error) {
      setFileError(
        error instanceof Error ? error.message : "Не удалось добавить файл",
      );
    } finally {
      setIsProcessingFiles(false);
    }
  }

  useEffect(() => {
    processFilesRef.current = processFiles;
  });

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    await processFiles(files);
  }

  function removeAttachment(id: string) {
    if (removingAttachmentIds.includes(id)) return;

    setRemovingAttachmentIds((current) => [...current, id]);

    const timer = window.setTimeout(() => {
      setAttachments((current) => current.filter((item) => item.id !== id));
      setRemovingAttachmentIds((current) =>
        current.filter((attachmentId) => attachmentId !== id),
      );
      removalTimersRef.current.delete(id);
      setFileError("");
    }, ATTACHMENT_REMOVE_DURATION);

    removalTimersRef.current.set(id, timer);
  }

  function changeModel(nextModelId: string) {
    clearRemovalTimers();
    setAttachments([]);
    setFileError("");
    setIsDragging(false);
    dragDepthRef.current = 0;
    onModelChange(nextModelId);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="chat-composer composer-shell relative rounded-[24px] border p-2.5 transition-[border-color,box-shadow,background-color] duration-300">
        <div
          className={`grid transition-[grid-template-rows,opacity,margin] duration-500 ease-out ${
            attachments.length > 0
              ? "mb-2 grid-rows-[1fr] opacity-100"
              : "mb-0 grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="flex flex-wrap gap-2">
              {attachments.map((attachment) => (
                <AttachmentCard
                  key={attachment.id}
                  attachment={attachment}
                  isRemoving={removingAttachmentIds.includes(attachment.id)}
                  disabled={controlsDisabled}
                  onRemove={removeAttachment}
                  onPreview={setPreviewAttachment}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="relative">
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-x-3 top-2.5 flex items-center overflow-hidden text-[15px] leading-6 transition-opacity duration-200 ${
              hasValue ? "opacity-0" : "opacity-55"
            }`}
          >
            <span className="truncate">{animatedPlaceholder}</span>
            {!hasValue && animatedPlaceholder ? (
              <span className="placeholder-caret ml-[1px] inline-block h-[17px] w-px shrink-0" />
            ) : null}
          </div>

          <textarea
            ref={textareaRef}
            value={value}
            rows={1}
            autoFocus
            disabled={disabled}
            placeholder=""
            aria-label="Сообщение"
            onKeyDown={handleKeyDown}
            onChange={(event) => {
              setValue(event.target.value);
              event.target.style.height = "auto";
              event.target.style.height = `${Math.min(
                event.target.scrollHeight,
                180,
              )}px`;
            }}
            className="composer-textarea relative z-10 block max-h-[180px] min-h-12 w-full resize-none bg-transparent px-3 py-2.5 text-[15px] leading-6 outline-none"
          />
        </div>

        {fileError ? (
          <p className="composer-error error-enter px-2 pb-1 pt-0.5 text-xs">
            {fileError}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex min-w-0 items-center gap-1">
            <ModelSelector
              value={modelId}
              onChange={changeModel}
              disabled={controlsDisabled || modelLocked || isProcessingFiles}
              locked={modelLocked}
              attachmentKinds={[
                ...new Set(attachments.map((attachment) => attachment.kind)),
              ]}
            />
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {canAttachMedia ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={inputAcceptedMediaTypes.join(",")}
                  onChange={handleFiles}
                  className="sr-only"
                />
                <button
                  type="button"
                  disabled={controlsDisabled || isProcessingFiles}
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Прикрепить фото или видео"
                  title="Прикрепить фото или видео"
                  className="composer-tool flex size-8 shrink-0 items-center justify-center rounded-xl transition duration-200 hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50"
                >
                  {isProcessingFiles ? (
                    <span
                      aria-hidden="true"
                      className="file-spinner size-4 rounded-full border-2"
                    />
                  ) : (
                    <PaperclipIcon className="size-[18px]" />
                  )}
                </button>
              </>
            ) : null}

            {isLoading ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Остановить ответ"
                title="Остановить ответ"
                className="composer-submit flex size-8 shrink-0 items-center justify-center rounded-xl transition duration-200 hover:scale-105 active:scale-95"
              >
                <StopIcon className="size-[18px]" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canSend}
                aria-label="Отправить"
                className="composer-submit flex size-8 shrink-0 items-center justify-center rounded-xl transition duration-200 enabled:hover:-translate-y-0.5 enabled:hover:scale-105 enabled:active:translate-y-0 enabled:active:scale-95 disabled:cursor-not-allowed"
              >
                <SendIcon className="size-[18px] translate-x-[-1px]" />
              </button>
            )}
          </div>
        </div>
      </div>

      {isDragging && typeof document !== "undefined"
        ? createPortal(
            <div className="global-drag-overlay pointer-events-none fixed inset-0 z-[110] flex items-center justify-center p-5 text-center backdrop-blur-sm">
              <div className="global-drag-target flex h-[calc(100%_-_2rem)] w-full items-center justify-center rounded-[28px] border-2 border-dashed">
                <div className="drag-content">
                  <div className="drag-icon mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl">
                    <PaperclipIcon className="size-5" />
                  </div>
                  <p className="text-base font-semibold">Отпустите файл</p>
                  <p className="mt-1 text-xs opacity-60">
                    Он прикрепится к сообщению · до {MAX_ATTACHMENTS} файлов
                  </p>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {previewAttachment && typeof document !== "undefined"
        ? createPortal(
            <AttachmentViewer
              attachment={previewAttachment}
              onClose={() => setPreviewAttachment(null)}
            />,
            document.body,
          )
        : null}

      <p className="composer-hint mt-2 text-center text-[11px]">
        {modelLocked
          ? "Модель закреплена за этим чатом"
          : acceptsMedia
            ? "Выберите модель или перетащите фото и видео в окно"
            : "Прикрепите файл — для него автоматически включится Auto"}
      </p>
      <p className="composer-disclaimer mt-1 text-center text-[11px]">
        <Link href="/help" className="composer-disclaimer-link">
          Hermes — ИИ и может ошибаться. Проверяйте важную информацию.
        </Link>
      </p>

      <style>{`
        .composer-shell {
          isolation: isolate;
        }

        .attachment-card {
          border-color: var(--border-soft);
          background: var(--surface-subtle);
          animation: attachment-enter 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
          transition:
            opacity ${ATTACHMENT_REMOVE_DURATION}ms ease,
            transform ${ATTACHMENT_REMOVE_DURATION}ms ease,
            filter ${ATTACHMENT_REMOVE_DURATION}ms ease,
            border-color 180ms ease,
            background-color 180ms ease;
        }

        .attachment-card:hover {
          transform: translateY(-1px);
        }

        .attachment-card--removing {
          pointer-events: none;
          opacity: 0;
          filter: blur(2px);
          transform: scale(0.96) translateY(-4px);
        }

        .attachment-remove {
          background: rgba(24, 24, 22, 0.7);
        }

        .attachment-remove:hover {
          background: rgba(24, 24, 22, 0.9);
          transform: rotate(8deg) scale(1.06);
        }

        .placeholder-caret {
          background: currentColor;
          animation: caret-blink 950ms steps(1, end) infinite;
        }

        .global-drag-overlay {
          background: color-mix(in srgb, var(--background) 80%, transparent);
        }

        .global-drag-target {
          border-color: color-mix(in srgb, var(--accent) 72%, var(--border));
          background: color-mix(in srgb, var(--surface) 72%, transparent);
          color: var(--foreground);
        }

        .drag-content {
          animation: drag-content-enter 360ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .drag-icon {
          background: var(--accent-soft);
          color: var(--accent);
          animation: drag-icon-float 1.5s ease-in-out infinite;
        }

        .attachment-viewer {
          background: rgba(15, 15, 14, 0.88);
          animation: viewer-enter 180ms ease-out both;
        }

        .attachment-viewer-close {
          background: rgba(255, 255, 255, 0.14);
        }

        .attachment-viewer-close:hover {
          background: rgba(255, 255, 255, 0.22);
        }

        .file-spinner {
          border-color: currentColor;
          border-right-color: transparent;
          animation: spinner-rotate 700ms linear infinite;
        }

        .error-enter {
          animation: error-enter 260ms ease-out both;
        }

        @keyframes attachment-enter {
          0% {
            opacity: 0;
            filter: blur(5px);
            transform: translateY(10px) scale(0.97);
          }
          100% {
            opacity: 1;
            filter: blur(0);
            transform: translateY(0) scale(1);
          }
        }

        @keyframes caret-blink {
          0%,
          48% {
            opacity: 1;
          }
          49%,
          100% {
            opacity: 0;
          }
        }

        @keyframes drag-content-enter {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes drag-icon-float {
          0%,
          100% {
            transform: translateY(0) rotate(-3deg);
          }
          50% {
            transform: translateY(-5px) rotate(3deg);
          }
        }

        @keyframes spinner-rotate {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes error-enter {
          from {
            opacity: 0;
            transform: translateY(-3px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes viewer-enter {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .attachment-card,
          .drag-content,
          .drag-icon,
          .file-spinner,
          .error-enter,
          .placeholder-caret,
          .attachment-viewer {
            animation: none !important;
          }

          .attachment-card,
          .composer-shell,
          .global-drag-overlay {
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </form>
  );
}
