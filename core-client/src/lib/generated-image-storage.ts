import type {
  ImageAspectRatio,
  ImageModelId,
  ImageQuality,
  ImageStyleId,
} from "./image-generation";
import {
  isImageAspectRatio,
  isImageModelId,
  isImageStyleId,
} from "./image-generation";

export type StoredGeneratedImage = {
  id: string;
  dataUrl: string;
  mimeType: string;
  prompt: string;
  model: ImageModelId;
  style: ImageStyleId;
  aspectRatio: ImageAspectRatio;
  quality: ImageQuality;
  seed: string;
  resolution: string;
  createdAt: number;
};

const STORAGE_KEY = "hermes-generated-images-v1";
const CHANGE_EVENT = "hermes-generated-images-change";
export const GENERATED_IMAGE_HISTORY_LIMIT = 12;
const MAX_SERIALIZED_CHARACTERS = 3_600_000;
const EMPTY_IMAGES: StoredGeneratedImage[] = [];

let cachedRaw: string | null | undefined;
let cachedImages: StoredGeneratedImage[] = EMPTY_IMAGES;

function isStoredImage(value: unknown): value is StoredGeneratedImage {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<StoredGeneratedImage>;

  return (
    typeof item.id === "string" &&
    typeof item.dataUrl === "string" &&
    item.dataUrl.startsWith("data:image/") &&
    typeof item.mimeType === "string" &&
    item.mimeType.startsWith("image/") &&
    typeof item.prompt === "string" &&
    isImageModelId(item.model) &&
    isImageStyleId(item.style) &&
    isImageAspectRatio(item.aspectRatio) &&
    (item.quality === "standard" || item.quality === "high") &&
    typeof item.seed === "string" &&
    typeof item.resolution === "string" &&
    typeof item.createdAt === "number" &&
    Number.isFinite(item.createdAt)
  );
}

function parseGeneratedImages(raw: string | null): StoredGeneratedImage[] {
  if (!raw) return EMPTY_IMAGES;

  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value)
      ? value.filter(isStoredImage).slice(0, GENERATED_IMAGE_HISTORY_LIMIT)
      : EMPTY_IMAGES;
  } catch {
    return EMPTY_IMAGES;
  }
}

export function getGeneratedImagesSnapshot(): StoredGeneratedImage[] {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedImages = parseGeneratedImages(raw);
  }
  return cachedImages;
}

export function getGeneratedImagesServerSnapshot(): StoredGeneratedImage[] {
  return EMPTY_IMAGES;
}

export function subscribeToGeneratedImages(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

export function loadGeneratedImages(): StoredGeneratedImage[] {
  return getGeneratedImagesSnapshot();
}

function notifyGeneratedImages(raw: string | null, images: StoredGeneratedImage[]) {
  cachedRaw = raw;
  cachedImages = images;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function saveGeneratedImages(images: StoredGeneratedImage[]) {
  const candidates = images.slice(0, GENERATED_IMAGE_HISTORY_LIMIT);
  let removedCount = Math.max(0, images.length - candidates.length);

  while (candidates.length > 0) {
    const serialized = JSON.stringify(candidates);
    if (serialized.length > MAX_SERIALIZED_CHARACTERS) {
      candidates.pop();
      removedCount += 1;
      continue;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, serialized);
      notifyGeneratedImages(serialized, [...candidates]);
      return { images: candidates, saved: true, removedCount };
    } catch {
      candidates.pop();
      removedCount += 1;
    }
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY);
    notifyGeneratedImages(null, EMPTY_IMAGES);
  } catch {
    // The image still stays in the current tab and remains downloadable.
  }
  return { images: [], saved: false, removedCount };
}

export function clearGeneratedImages() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    notifyGeneratedImages(null, EMPTY_IMAGES);
    return true;
  } catch {
    return false;
  }
}
