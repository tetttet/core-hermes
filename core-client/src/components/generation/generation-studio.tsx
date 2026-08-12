"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { GenerationControls } from "@/components/generation/generation-controls";
import {
  GenerationResults,
  type GenerationStatus,
} from "@/components/generation/generation-results";
import {
  type ImageAspectRatio,
  type ImageGenerationErrorResponse,
  type ImageGenerationPollResponse,
  type ImageGenerationStartResponse,
  type ImageModelId,
  type ImageQuality,
  type ImageStyleId,
} from "@/lib/image-generation";
import {
  clearGeneratedImages,
  GENERATED_IMAGE_HISTORY_LIMIT,
  loadGeneratedImages,
  saveGeneratedImages,
  type StoredGeneratedImage,
} from "@/lib/generated-image-storage";

const MAX_PROMPT_LENGTH = 1_600;
const MAX_POLL_ATTEMPTS = 180;

function delay(duration: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, duration));
}

function getImageExtension(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  return "webp";
}

async function parseGenerationResponse<T>(response: Response) {
  const body = await response.json().catch(() => null) as
    | T
    | ImageGenerationErrorResponse
    | null;
  if (!response.ok) {
    throw new Error(
      body && typeof body === "object" && "error" in body
        ? body.error
        : "Не удалось выполнить генерацию.",
    );
  }
  if (!body) throw new Error("Сервис вернул пустой ответ.");
  return body as T;
}

export function GenerationStudio() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<ImageModelId>("stable_diffusion");
  const [style, setStyle] = useState<ImageStyleId>("none");
  const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio>("1:1");
  const [quality, setQuality] = useState<ImageQuality>("standard");
  const [seed, setSeed] = useState("");
  const [images, setImages] = useState<StoredGeneratedImage[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<StoredGeneratedImage | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [storageMessage, setStorageMessage] = useState("");
  const [status, setStatus] = useState<GenerationStatus>({
    phase: "idle",
    message: "Готово к новой идее",
  });
  const mountedRef = useRef(true);
  const isGenerating = ["submitting", "waiting", "generating", "saving"].includes(
    status.phase,
  );
  const selectedImage = useMemo(
    () => images.find((image) => image.id === selectedImageId) ?? images[0] ?? null,
    [images, selectedImageId],
  );

  useEffect(() => {
    let cancelled = false;
    mountedRef.current = true;
    queueMicrotask(() => {
      if (cancelled) return;
      const storedImages = loadGeneratedImages();
      setImages(storedImages);
      setSelectedImageId(storedImages[0]?.id ?? null);
      setIsHydrated(true);
    });
    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, []);

  async function pollGeneration(requestId: string) {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
      const response = await fetch(
        `/api/image-generation/horde?requestId=${encodeURIComponent(requestId)}`,
        { cache: "no-store" },
      );
      const result = await parseGenerationResponse<ImageGenerationPollResponse>(
        response,
      );
      if (!mountedRef.current) throw new Error("Генерация остановлена.");

      if (result.state === "done") return result;
      if (result.state === "failed") throw new Error(result.error);

      setStatus({
        phase: result.state,
        message: result.statusMessage,
      });
      await delay(result.state === "waiting" ? 3_500 : 2_500);
    }

    throw new Error("Генерация заняла слишком много времени. Попробуйте снова.");
  }

  async function generateImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isGenerating) return;

    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) {
      setStatus({ phase: "error", message: "Сначала опишите изображение." });
      return;
    }

    setStorageMessage("");
    setPendingPrompt(cleanPrompt);
    setStatus({ phase: "submitting", message: "Добавляем запрос в очередь…" });

    try {
      const response = await fetch("/api/image-generation/horde", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: cleanPrompt,
          model,
          style,
          aspectRatio,
          quality,
          seed: seed.trim() || undefined,
        }),
        cache: "no-store",
      });
      const started = await parseGenerationResponse<ImageGenerationStartResponse>(
        response,
      );

      setStatus({
        phase: started.state === "done" ? "generating" : "waiting",
        message: started.statusMessage,
      });
      const result = started.state === "done"
        ? started
        : await pollGeneration(started.requestId);
      setStatus({ phase: "saving", message: "Сохраняем результат в браузере…" });

      const image: StoredGeneratedImage = {
        id: crypto.randomUUID(),
        dataUrl: result.imageDataUrl,
        mimeType: result.mimeType,
        prompt: cleanPrompt,
        model,
        style,
        aspectRatio,
        quality,
        seed: result.seed || started.seed,
        resolution: started.resolution,
        createdAt: Date.now(),
      };
      const nextImages = [
        image,
        ...loadGeneratedImages().filter((item) => item.id !== image.id),
      ];
      const stored = saveGeneratedImages(nextImages);

      setImages(
        stored.saved
          ? stored.images
          : nextImages.slice(0, GENERATED_IMAGE_HISTORY_LIMIT),
      );
      setSelectedImageId(image.id);
      if (!stored.saved) {
        setStorageMessage(
          "Изображение доступно в этой вкладке, но не поместилось в localStorage. Скачайте его до закрытия страницы.",
        );
      } else if (stored.removedCount > 0) {
        setStorageMessage(
          "Чтобы не переполнить localStorage, самые старые изображения были удалены.",
        );
      }
      setSeed(image.seed);
      setPendingPrompt("");
      setStatus({ phase: "success", message: "Изображение готово" });
    } catch (error) {
      if (!mountedRef.current) return;
      setStatus({
        phase: "error",
        message:
          error instanceof Error
            ? error.message
            : "Не удалось создать изображение.",
      });
    }
  }

  function downloadImage(image: StoredGeneratedImage) {
    const anchor = document.createElement("a");
    anchor.href = image.dataUrl;
    anchor.download = `hermes-${image.createdAt}.${getImageExtension(image.mimeType)}`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  }

  function removeImage(imageId: string) {
    const nextImages = images.filter((image) => image.id !== imageId);
    const stored = saveGeneratedImages(nextImages);
    setImages(stored.images);
    setSelectedImageId((current) =>
      current === imageId ? (stored.images[0]?.id ?? null) : current,
    );
    setPreviewImage((current) => current?.id === imageId ? null : current);
    setStorageMessage("");
  }

  function clearGallery() {
    clearGeneratedImages();
    setImages([]);
    setSelectedImageId(null);
    setPreviewImage(null);
    setPendingPrompt("");
    setIsClearDialogOpen(false);
    setStorageMessage("");
    setStatus({ phase: "idle", message: "Локальная история очищена" });
  }

  function reuseSettings(image: StoredGeneratedImage) {
    setPrompt(image.prompt);
    setModel(image.model);
    setStyle(image.style);
    setAspectRatio(image.aspectRatio);
    setQuality(image.quality);
    setSeed(image.seed);
    setSelectedImageId(image.id);
    setPreviewImage(null);
    setStatus({ phase: "idle", message: "Настройки перенесены в форму" });
    window.setTimeout(() => {
      document.getElementById("generation-prompt")?.focus();
    }, 0);
  }

  function openConversationImage(image: StoredGeneratedImage) {
    setSelectedImageId(image.id);
    const section = document.getElementById(`generation-message-${image.id}`);
    if (typeof section?.scrollIntoView === "function") {
      section.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function useSuggestion(suggestion: string) {
    setPrompt(suggestion);
    window.requestAnimationFrame(() => {
      document.getElementById("generation-prompt")?.focus();
    });
  }

  return (
    <section
      className="generation-studio"
      data-sidebar-collapsed={isSidebarCollapsed}
      aria-label="Студия генерации изображений"
    >
      <GenerationResults
        images={images}
        selectedImage={selectedImage}
        previewImage={previewImage}
        pendingPrompt={pendingPrompt}
        isHydrated={isHydrated}
        isGenerating={isGenerating}
        status={status}
        storageMessage={storageMessage}
        aspectRatio={aspectRatio}
        isClearDialogOpen={isClearDialogOpen}
        isSidebarCollapsed={isSidebarCollapsed}
        onSelectImage={openConversationImage}
        onPreviewImage={setPreviewImage}
        onDownloadImage={downloadImage}
        onReuseSettings={reuseSettings}
        onRemoveImage={removeImage}
        onUseSuggestion={useSuggestion}
        onToggleSidebar={() => setIsSidebarCollapsed((current) => !current)}
        onRequestClear={() => setIsClearDialogOpen(true)}
        onCancelClear={() => setIsClearDialogOpen(false)}
        onConfirmClear={clearGallery}
      />
      <GenerationControls
        prompt={prompt}
        model={model}
        style={style}
        aspectRatio={aspectRatio}
        quality={quality}
        seed={seed}
        maxPromptLength={MAX_PROMPT_LENGTH}
        isGenerating={isGenerating}
        onPromptChange={setPrompt}
        onModelChange={setModel}
        onStyleChange={setStyle}
        onAspectRatioChange={setAspectRatio}
        onQualityChange={setQuality}
        onSeedChange={setSeed}
        onSubmit={generateImage}
      />
    </section>
  );
}
