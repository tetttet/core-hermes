export type AttachmentKind = "image" | "video";

export type ModelOption = {
  id: string;
  title: string;
  provider: string;
  description: string;
  supportsVision: boolean;
  supportsVideo: boolean;
  isFree: boolean;
  priority: number;
  recommended: boolean;
  enabled: boolean;
};

// Локальный ID: он никогда не отправляется в OpenRouter как имя модели.
export const AUTO_MODEL_ID = "hermes/auto-vision-safe";
export const OPENROUTER_FREE_MODEL_ID = "openrouter/free";

// Порядок одновременно задаёт приоритет Auto и последовательность fallback.
export const VISION_FALLBACK_MODEL_IDS = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "nvidia/nemotron-nano-12b-v2-vl:free",
  OPENROUTER_FREE_MODEL_ID,
] as const;

// Единый каталог для селекторов, server-side validation и маршрутизации.
export const MODEL_CATALOG = [
  {
    id: AUTO_MODEL_ID,
    title: "Auto · Vision Safe",
    provider: "Hermes",
    description:
      "Безопасно выбирает только мультимодальные модели и переключается на резервную при временном сбое.",
    supportsVision: true,
    supportsVideo: true,
    isFree: true,
    priority: 0,
    recommended: true,
    enabled: true,
  },
  {
    id: "google/gemma-4-31b-it:free",
    title: "Gemma 4 31B",
    provider: "Google",
    description: "Рекомендуемая бесплатная модель для анализа фото и документов.",
    supportsVision: true,
    supportsVideo: false,
    isFree: true,
    priority: 10,
    recommended: true,
    enabled: true,
  },
  {
    id: "google/gemma-4-26b-a4b-it:free",
    title: "Gemma 4 26B A4B",
    provider: "Google",
    description: "Быстрая бесплатная мультимодальная модель для фото и видео.",
    supportsVision: true,
    supportsVideo: true,
    isFree: true,
    priority: 20,
    recommended: true,
    enabled: true,
  },
  {
    id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    title: "Nemotron 3 Nano Omni",
    provider: "NVIDIA",
    description: "Мультимодальные рассуждения по фото и видео.",
    supportsVision: true,
    supportsVideo: true,
    isFree: true,
    priority: 30,
    recommended: true,
    enabled: true,
  },
  {
    id: "nvidia/nemotron-nano-12b-v2-vl:free",
    title: "Nemotron Nano 12B VL",
    provider: "NVIDIA",
    description: "Анализ изображений и видео, распознавание деталей и визуальные вопросы.",
    supportsVision: true,
    supportsVideo: true,
    isFree: true,
    priority: 40,
    recommended: false,
    enabled: true,
  },
  {
    id: OPENROUTER_FREE_MODEL_ID,
    title: "Auto Free",
    provider: "OpenRouter",
    description: "Бесплатный роутер OpenRouter; в Auto используется только последним резервом для фото.",
    supportsVision: true,
    supportsVideo: false,
    isFree: true,
    priority: 50,
    recommended: false,
    enabled: true,
  },
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b:free",
    title: "Nemotron 3 Ultra",
    provider: "NVIDIA",
    description: "Для сложного анализа, рассуждений и подробных текстовых ответов.",
    supportsVision: false,
    supportsVideo: false,
    isFree: true,
    priority: 100,
    recommended: false,
    enabled: true,
  },
  {
    id: "inclusionai/ling-3.0-flash:free",
    title: "Ling 3.0 Flash",
    provider: "InclusionAI",
    description: "Быстрые ответы, повседневные вопросы, переводы и краткие сводки.",
    supportsVision: false,
    supportsVideo: false,
    isFree: true,
    priority: 110,
    recommended: false,
    enabled: true,
  },
  {
    id: "poolside/laguna-s-2.1:free",
    title: "Laguna S 2.1",
    provider: "Poolside",
    description: "Программирование, разбор кода и структурированные технические задачи.",
    supportsVision: false,
    supportsVideo: false,
    isFree: true,
    priority: 120,
    recommended: false,
    enabled: true,
  },
  {
    id: "nvidia/nemotron-3-super-120b-a12b:free",
    title: "Nemotron 3 Super",
    provider: "NVIDIA",
    description: "Баланс скорости и качества для логики, текста и общих задач.",
    supportsVision: false,
    supportsVideo: false,
    isFree: true,
    priority: 130,
    recommended: false,
    enabled: true,
  },
] as const satisfies readonly ModelOption[];

export const MODELS: readonly ModelOption[] = MODEL_CATALOG.filter(
  (model) => model.enabled,
).sort((left, right) => left.priority - right.priority);

export const DEFAULT_MODEL_ID = AUTO_MODEL_ID;

export function isSupportedModel(modelId: string) {
  return MODELS.some((model) => model.id === modelId);
}

export function findModel(modelId: string) {
  return MODELS.find((model) => model.id === modelId);
}

export function getModel(modelId: string) {
  return findModel(modelId) ?? MODELS[0];
}

export function modelAccepts(modelId: string, kind: AttachmentKind) {
  const model = findModel(modelId);
  if (!model) return false;
  return kind === "image" ? model.supportsVision : model.supportsVideo;
}

export function getModelCapabilityLabel(model: ModelOption) {
  if (model.supportsVideo) return "Фото и видео";
  if (model.supportsVision) return "Фото";
  return "Только текст";
}
