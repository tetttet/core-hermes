"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import {
  CopyIcon,
  DownloadIcon,
  ExpandIcon,
  ImageIcon,
  MoreHorizontalIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  RefreshIcon,
  TrashIcon,
  XIcon,
} from "@/components/icons";
import { writeToClipboard } from "@/lib/clipboard";
import {
  IMAGE_ASPECT_RATIOS,
  IMAGE_MODELS,
  IMAGE_STYLES,
  type ImageAspectRatio,
} from "@/lib/image-generation";
import type { StoredGeneratedImage } from "@/lib/generated-image-storage";

export type GenerationPhase =
  | "idle"
  | "submitting"
  | "waiting"
  | "generating"
  | "saving"
  | "success"
  | "error";

export type GenerationStatus = {
  phase: GenerationPhase;
  message: string;
};

type GenerationResultsProps = {
  images: StoredGeneratedImage[];
  selectedImage: StoredGeneratedImage | null;
  previewImage: StoredGeneratedImage | null;
  pendingPrompt: string;
  isHydrated: boolean;
  isGenerating: boolean;
  status: GenerationStatus;
  storageMessage: string;
  aspectRatio: ImageAspectRatio;
  isClearDialogOpen: boolean;
  isSidebarCollapsed: boolean;
  onSelectImage: (image: StoredGeneratedImage) => void;
  onPreviewImage: (image: StoredGeneratedImage | null) => void;
  onDownloadImage: (image: StoredGeneratedImage) => void;
  onReuseSettings: (image: StoredGeneratedImage) => void;
  onRemoveImage: (imageId: string) => void;
  onUseSuggestion: (prompt: string) => void;
  onToggleSidebar: () => void;
  onRequestClear: () => void;
  onCancelClear: () => void;
  onConfirmClear: () => void;
};

function formatGeneratedAt(timestamp: number, includeYear = false) {
  const date = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    ...(includeYear ? { year: "numeric" as const } : {}),
  }).format(timestamp);
  const time = new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);

  return `${date} · ${time}`;
}

function findModelName(image: StoredGeneratedImage) {
  return IMAGE_MODELS.find((item) => item.id === image.model)?.name ?? image.model;
}

function findStyleName(image: StoredGeneratedImage) {
  return IMAGE_STYLES.find((item) => item.id === image.style)?.name ?? image.style;
}

function GeneratedImage({
  image,
  sizes,
  priority = false,
}: {
  image: StoredGeneratedImage;
  sizes: string;
  priority?: boolean;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const failed = failedSource === image.dataUrl;

  if (failed) {
    return (
      <div className="generation-image-error" role="img" aria-label="Изображение не загрузилось">
        <ImageIcon className="size-6" />
        <span>Не удалось открыть изображение</span>
      </div>
    );
  }

  return (
    <Image
      src={image.dataUrl}
      alt={image.prompt}
      fill
      unoptimized
      priority={priority}
      sizes={sizes}
      onError={() => setFailedSource(image.dataUrl)}
    />
  );
}

function GenerationSidebar({
  images,
  selectedImage,
  isHydrated,
  isGenerating,
  isCollapsed,
  onSelect,
  onRemove,
  onClear,
  onToggle,
}: {
  images: StoredGeneratedImage[];
  selectedImage: StoredGeneratedImage | null;
  isHydrated: boolean;
  isGenerating: boolean;
  isCollapsed: boolean;
  onSelect: (image: StoredGeneratedImage) => void;
  onRemove: (imageId: string) => void;
  onClear: () => void;
  onToggle: () => void;
}) {
  return (
    <aside className="generation-sidebar" aria-label="История генераций" data-collapsed={isCollapsed}>
      <header className="generation-sidebar-header">
        <div className="generation-sidebar-title">
          <span>История</span>
          <small>{images.length}</small>
        </div>
        <div className="generation-sidebar-actions">
          {images.length > 0 ? (
            <button
              type="button"
              onClick={onClear}
              disabled={isGenerating}
              aria-label="Очистить историю"
              title="Очистить историю"
            >
              <TrashIcon className="size-4" />
            </button>
          ) : null}
          <button
            type="button"
            className="generation-sidebar-toggle"
            onClick={onToggle}
            aria-label={isCollapsed ? "Развернуть историю" : "Свернуть историю"}
            title={isCollapsed ? "Развернуть историю" : "Свернуть историю"}
          >
            {isCollapsed ? (
              <PanelLeftOpenIcon className="size-4" />
            ) : (
              <PanelLeftCloseIcon className="size-4" />
            )}
          </button>
        </div>
      </header>

      <div className="generation-sidebar-list">
        {!isHydrated ? (
          <div className="generation-sidebar-loading" aria-label="Загрузка истории" />
        ) : images.length === 0 ? (
          <div className="generation-sidebar-empty">
            <span><ImageIcon className="size-4" /></span>
            <strong>История пока пуста</strong>
            <small>Здесь появятся ваши изображения</small>
          </div>
        ) : (
          images.map((image) => (
            <article
              key={image.id}
              className="generation-sidebar-item"
              data-selected={selectedImage?.id === image.id}
            >
              <button
                type="button"
                className="generation-sidebar-select"
                onClick={() => onSelect(image)}
                aria-label={`Открыть генерацию «${image.prompt}»`}
              >
                <span className="generation-sidebar-thumb">
                  <GeneratedImage image={image} sizes="5rem" />
                </span>
                <span className="generation-sidebar-copy">
                  <strong>{image.prompt}</strong>
                  <small>{findModelName(image)} · {image.aspectRatio}</small>
                  <time dateTime={new Date(image.createdAt).toISOString()}>
                    {formatGeneratedAt(image.createdAt)}
                  </time>
                </span>
              </button>
              <button
                type="button"
                className="generation-sidebar-remove"
                onClick={() => onRemove(image.id)}
                disabled={isGenerating}
                aria-label={`Удалить изображение «${image.prompt}»`}
                title="Удалить"
              >
                <MoreHorizontalIcon className="size-4" />
              </button>
            </article>
          ))
        )}
      </div>

      <footer className="generation-sidebar-footer">
        <span>Хранится только в этом браузере</span>
      </footer>
    </aside>
  );
}

const EMPTY_SUGGESTIONS = [
  "Кинематографичный город после дождя, отражения неона, ночной свет",
  "Editorial-портрет в тёплом архитектурном пространстве",
];

function GenerationEmptyState({
  aspectRatio,
  onUseSuggestion,
}: {
  aspectRatio: ImageAspectRatio;
  onUseSuggestion: (prompt: string) => void;
}) {
  const ratio = IMAGE_ASPECT_RATIOS.find((item) => item.id === aspectRatio) ??
    IMAGE_ASPECT_RATIOS[0];

  return (
    <div className="generation-empty-stage">
      <div className="generation-empty-art" aria-hidden="true">
        <figure className="generation-art-card generation-art-card-a">
          <Image src="/generation/architecture.webp" alt="" fill sizes="18rem" />
        </figure>
        <figure className="generation-art-card generation-art-card-b">
          <Image src="/generation/editorial.webp" alt="" fill sizes="15rem" />
        </figure>
        <figure className="generation-art-card generation-art-card-c">
          <Image src="/generation/still-life.webp" alt="" fill sizes="16rem" />
        </figure>
        <figure className="generation-art-card generation-art-card-d">
          <Image src="/generation/hero.png" alt="" fill sizes="18rem" />
        </figure>
      </div>

      <div className="generation-empty-copy">
        <span className="generation-empty-eyebrow">
          <Image src="/yahya.svg" alt="" width={18} height={18} unoptimized />
          Hermes Image
        </span>
        <h1>Представьте. Опишите.<br />Создайте.</h1>
        <p>
          Один диалог для всех визуальных идей. Выберите модель и формат снизу —
          Hermes сохранит результаты в истории слева.
        </p>
        <div className="generation-empty-suggestions" aria-label="Примеры промптов">
          {EMPTY_SUGGESTIONS.map((suggestion, index) => (
            <button key={suggestion} type="button" onClick={() => onUseSuggestion(suggestion)}>
              <span>0{index + 1}</span>
              {suggestion}
            </button>
          ))}
        </div>
        <small>{ratio.width} × {ratio.height} · текущий формат {aspectRatio}</small>
      </div>
    </div>
  );
}

function GenerationMessage({
  image,
  disabled,
  onPreview,
  onDownload,
  onReuse,
  onRemove,
}: {
  image: StoredGeneratedImage;
  disabled: boolean;
  onPreview: () => void;
  onDownload: () => void;
  onReuse: () => void;
  onRemove: () => void;
}) {
  return (
    <article
      id={`generation-message-${image.id}`}
      className="generation-message"
    >
      <div className="generation-user-message">
        <div>
          <p>{image.prompt}</p>
          <time dateTime={new Date(image.createdAt).toISOString()}>
            {formatGeneratedAt(image.createdAt)}
          </time>
        </div>
      </div>

      <div className="generation-assistant-message">
        <span className="generation-assistant-avatar" aria-hidden="true">
          <Image src="/yahya.svg" alt="" width={22} height={22} unoptimized />
        </span>
        <div className="generation-message-result">
          <div
            className="generation-message-media"
            style={{ aspectRatio: image.aspectRatio.replace(":", " / ") }}
          >
            <button
              type="button"
              onClick={onPreview}
              aria-label="Открыть изображение на весь экран"
            >
              <GeneratedImage image={image} sizes="(max-width: 800px) 92vw, 48rem" />
            </button>
            <div className="generation-message-media-actions">
              <button type="button" onClick={onPreview} aria-label="Открыть">
                <ExpandIcon className="size-4" />
              </button>
              <button type="button" onClick={onDownload} aria-label="Скачать изображение">
                <DownloadIcon className="size-4" />
              </button>
            </div>
          </div>
          <div className="generation-message-details">
            <div>
              <strong>{findModelName(image)}</strong>
              <span>{findStyleName(image)} · {image.aspectRatio} · {image.resolution}</span>
            </div>
            <div>
              <button type="button" onClick={onReuse}>
                <RefreshIcon className="size-4" /> Повторить
              </button>
              <button type="button" onClick={onRemove} disabled={disabled} aria-label="Удалить изображение">
                <TrashIcon className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function GeneratingMessage({
  prompt,
  status,
  aspectRatio,
}: {
  prompt: string;
  status: GenerationStatus;
  aspectRatio: ImageAspectRatio;
}) {
  const ratio = IMAGE_ASPECT_RATIOS.find((item) => item.id === aspectRatio) ??
    IMAGE_ASPECT_RATIOS[0];

  return (
    <article className="generation-message generation-message-pending">
      <div className="generation-user-message">
        <div><p>{prompt}</p><span>сейчас</span></div>
      </div>
      <div className="generation-assistant-message">
        <span className="generation-assistant-avatar" aria-hidden="true">
          <Image src="/yahya.svg" alt="" width={22} height={22} unoptimized />
        </span>
        {status.phase === "error" ? (
          <div className="generation-chat-error" role="alert">
            <strong>Не удалось создать изображение</strong>
            <p>{status.message}</p>
          </div>
        ) : (
          <div
            className="generation-thinking-card"
            style={{ aspectRatio: aspectRatio.replace(":", " / ") }}
          >
            <div className="generation-thinking-glow" />
            <span className="generation-thinking-logo">
              <Image src="/yahya.svg" alt="" width={34} height={34} unoptimized />
            </span>
            <strong>Hermes создаёт изображение</strong>
            <p>{status.message}</p>
            <small>{ratio.width} × {ratio.height}</small>
          </div>
        )}
      </div>
    </article>
  );
}

function ImagePreviewDialog({
  image,
  onClose,
  onDownload,
  onReuse,
}: {
  image: StoredGeneratedImage;
  onClose: () => void;
  onDownload: () => void;
  onReuse: () => void;
}) {
  const titleId = useId();
  const [copyMessage, setCopyMessage] = useState("Копировать промпт");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  async function copyPrompt() {
    try {
      await writeToClipboard(image.prompt);
      setCopyMessage("Промпт скопирован");
    } catch {
      setCopyMessage("Не удалось скопировать");
    }
  }

  return (
    <div className="generation-preview-backdrop" onClick={onClose}>
      <div
        className="generation-preview-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="generation-preview-close" onClick={onClose} aria-label="Закрыть просмотр">
          <XIcon className="size-5" />
        </button>
        <div className="generation-preview-media">
          <div style={{ aspectRatio: image.aspectRatio.replace(":", " / ") }}>
            <GeneratedImage image={image} sizes="(max-width: 800px) 100vw, 72vw" priority />
          </div>
        </div>
        <aside className="generation-preview-details">
          <div><p className="generation-kicker">Детали генерации</p><h2 id={titleId}>Изображение</h2></div>
          <p className="generation-preview-prompt">{image.prompt}</p>
          <dl>
            <div><dt>Модель</dt><dd>{findModelName(image)}</dd></div>
            <div><dt>Стиль</dt><dd>{findStyleName(image)}</dd></div>
            <div><dt>Формат</dt><dd>{image.aspectRatio} · {image.resolution}</dd></div>
            <div><dt>Качество</dt><dd>{image.quality === "high" ? "Высокое" : "Стандарт"}</dd></div>
            <div><dt>Seed</dt><dd>{image.seed}</dd></div>
            <div><dt>Создано</dt><dd>{formatGeneratedAt(image.createdAt, true)}</dd></div>
          </dl>
          <div className="generation-preview-actions">
            <button type="button" className="generation-preview-primary" onClick={onDownload}>
              <DownloadIcon className="size-4" /> Скачать
            </button>
            <button type="button" onClick={copyPrompt}><CopyIcon className="size-4" /> {copyMessage}</button>
            <button type="button" onClick={onReuse}><RefreshIcon className="size-4" /> Повторить настройки</button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ClearHistoryDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const titleId = useId();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div className="generation-confirm-backdrop" onClick={onCancel}>
      <div className="generation-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} onClick={(event) => event.stopPropagation()}>
        <span className="generation-confirm-icon"><TrashIcon className="size-5" /></span>
        <h2 id={titleId}>Очистить локальную историю?</h2>
        <p>Все созданные изображения будут удалены из этого браузера. Отменить действие не получится.</p>
        <div>
          <button type="button" onClick={onCancel}>Отмена</button>
          <button type="button" className="generation-confirm-delete" onClick={onConfirm}>Очистить</button>
        </div>
      </div>
    </div>
  );
}

function DeleteImageDialog({
  image,
  onCancel,
  onConfirm,
}: {
  image: StoredGeneratedImage;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div className="generation-confirm-backdrop" onClick={onCancel}>
      <div
        className="generation-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <span className="generation-confirm-icon"><TrashIcon className="size-5" /></span>
        <h2 id={titleId}>Удалить изображение?</h2>
        <p>Генерация «{image.prompt}» будет удалена из локальной истории.</p>
        <div>
          <button type="button" onClick={onCancel}>Отмена</button>
          <button type="button" className="generation-confirm-delete" onClick={onConfirm}>Удалить</button>
        </div>
      </div>
    </div>
  );
}

export function GenerationResults({
  images,
  selectedImage,
  previewImage,
  pendingPrompt,
  isHydrated,
  isGenerating,
  status,
  storageMessage,
  aspectRatio,
  isClearDialogOpen,
  isSidebarCollapsed,
  onSelectImage,
  onPreviewImage,
  onDownloadImage,
  onReuseSettings,
  onRemoveImage,
  onUseSuggestion,
  onToggleSidebar,
  onRequestClear,
  onCancelClear,
  onConfirmClear,
}: GenerationResultsProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [imagePendingRemoval, setImagePendingRemoval] = useState<StoredGeneratedImage | null>(null);

  useEffect(() => {
    if (!isGenerating && status.phase !== "success") return;
    if (typeof bottomRef.current?.scrollIntoView === "function") {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [images.length, isGenerating, status.phase]);

  const conversationImages = [...images].reverse();

  return (
    <>
      <GenerationSidebar
        images={images}
        selectedImage={selectedImage}
        isHydrated={isHydrated}
        isGenerating={isGenerating}
        isCollapsed={isSidebarCollapsed}
        onSelect={onSelectImage}
        onRemove={(imageId) => {
          setImagePendingRemoval(images.find((image) => image.id === imageId) ?? null);
        }}
        onClear={onRequestClear}
        onToggle={onToggleSidebar}
      />

      <section className="generation-conversation" aria-label="Диалог генерации">
        <div className="generation-conversation-scroll">
          {!isHydrated ? (
            <div className="generation-chat-loading" aria-label="Загрузка локальной галереи" />
          ) : images.length === 0 && !pendingPrompt ? (
            <GenerationEmptyState aspectRatio={aspectRatio} onUseSuggestion={onUseSuggestion} />
          ) : (
            <div className="generation-message-list">
              {conversationImages.map((image) => (
                <GenerationMessage
                  key={image.id}
                  image={image}
                  disabled={isGenerating}
                  onPreview={() => onPreviewImage(image)}
                  onDownload={() => onDownloadImage(image)}
                  onReuse={() => onReuseSettings(image)}
                  onRemove={() => setImagePendingRemoval(image)}
                />
              ))}
              {pendingPrompt ? (
                <GeneratingMessage prompt={pendingPrompt} status={status} aspectRatio={aspectRatio} />
              ) : null}
              {storageMessage ? <p className="generation-chat-storage" role="alert">{storageMessage}</p> : null}
              <div ref={bottomRef} aria-hidden="true" />
            </div>
          )}
        </div>
      </section>

      {previewImage ? (
        <ImagePreviewDialog
          image={previewImage}
          onClose={() => onPreviewImage(null)}
          onDownload={() => onDownloadImage(previewImage)}
          onReuse={() => onReuseSettings(previewImage)}
        />
      ) : null}

      {isClearDialogOpen ? <ClearHistoryDialog onCancel={onCancelClear} onConfirm={onConfirmClear} /> : null}

      {imagePendingRemoval ? (
        <DeleteImageDialog
          image={imagePendingRemoval}
          onCancel={() => setImagePendingRemoval(null)}
          onConfirm={() => {
            onRemoveImage(imagePendingRemoval.id);
            setImagePendingRemoval(null);
          }}
        />
      ) : null}
    </>
  );
}
