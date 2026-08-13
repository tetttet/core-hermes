export type AttachmentKind = "image" | "video";

export type ModelGroup =
  | "universal"
  | "vision"
  | "coding"
  | "reasoning"
  | "fast"
  | "specialized";

export type ModelOption = {
  id: string;
  title: string;
  provider: string;
  description: string;
  group: ModelGroup;
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

// В Auto используем только модели, которые прошли реальную проверку API.
export const VISION_FALLBACK_MODEL_IDS = [
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  OPENROUTER_FREE_MODEL_ID,
] as const;

export const TEXT_FALLBACK_MODEL_IDS = [
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "openai/gpt-oss-20b:free",
  OPENROUTER_FREE_MODEL_ID,
] as const;

const MANDATORY_REASONING_MODEL_IDS = new Set([
  "liquid/lfm-2.5-2.6b:free",
  "openai/gpt-oss-20b:free",
]);

export function getModelReasoning(modelId: string) {
  return {
    effort: MANDATORY_REASONING_MODEL_IDS.has(modelId) ? "minimal" : "none",
    exclude: true,
  } as const;
}

// Единый каталог для селекторов, server-side validation и маршрутизации.
export const MODEL_CATALOG = [
  {
    id: AUTO_MODEL_ID,
    title: "Auto · Vision Safe",
    provider: "Hermes",
    description:
      "Безопасно выбирает только мультимодальные модели и переключается на резервную при временном сбое.",
    group: "universal",
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
    group: "vision",
    supportsVision: true,
    supportsVideo: true,
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
    group: "vision",
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
    group: "vision",
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
    group: "vision",
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
    group: "universal",
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
    group: "reasoning",
    supportsVision: false,
    supportsVideo: false,
    isFree: true,
    priority: 100,
    recommended: false,
    enabled: true,
  },
  {
    id: "nvidia/nemotron-3-super-120b-a12b:free",
    title: "Nemotron 3 Super",
    provider: "NVIDIA",
    description: "Баланс скорости и качества для логики, текста и общих задач.",
    group: "reasoning",
    supportsVision: false,
    supportsVideo: false,
    isFree: true,
    priority: 110,
    recommended: false,
    enabled: true,
  },
  {
    id: "nvidia/nemotron-3-nano-30b-a3b:free",
    title: "Nemotron 3 Nano 30B",
    provider: "NVIDIA",
    description: "Компактные рассуждения, агентные сценарии и работа с инструментами.",
    group: "reasoning",
    supportsVision: false,
    supportsVideo: false,
    isFree: true,
    priority: 120,
    recommended: false,
    enabled: true,
  },
  {
    id: "openai/gpt-oss-20b:free",
    title: "GPT-OSS 20B",
    provider: "OpenAI",
    description: "Рассуждения, вызов инструментов и структурированные ответы.",
    group: "reasoning",
    supportsVision: false,
    supportsVideo: false,
    isFree: true,
    priority: 130,
    recommended: false,
    enabled: true,
  },
  {
    id: "poolside/laguna-s-2.1:free",
    title: "Laguna S 2.1",
    provider: "Poolside",
    description: "Сложная агентная разработка, терминал и большие изменения в коде.",
    group: "coding",
    supportsVision: false,
    supportsVideo: false,
    isFree: true,
    priority: 200,
    recommended: false,
    enabled: true,
  },
  {
    id: "poolside/laguna-xs-2.1:free",
    title: "Laguna XS 2.1",
    provider: "Poolside",
    description: "Быстрые правки, разбор репозитория и повседневные задачи с кодом.",
    group: "coding",
    supportsVision: false,
    supportsVideo: false,
    isFree: true,
    priority: 210,
    recommended: false,
    enabled: true,
  },
  {
    id: "cohere/north-mini-code:free",
    title: "North Mini Code",
    provider: "Cohere",
    description: "Агентное программирование и работа с длинным контекстом проекта.",
    group: "coding",
    supportsVision: false,
    supportsVideo: false,
    isFree: true,
    priority: 220,
    recommended: false,
    enabled: true,
  },
  {
    id: "nvidia/nemotron-3.5-lightning:free",
    title: "Nemotron 3.5 Lightning",
    provider: "NVIDIA",
    description: "Очень быстрые агентные задачи и контекст до миллиона токенов.",
    group: "fast",
    supportsVision: false,
    supportsVideo: false,
    isFree: true,
    priority: 300,
    recommended: false,
    enabled: true,
  },
  {
    id: "nvidia/nemotron-nano-9b-v2:free",
    title: "Nemotron Nano 9B V2",
    provider: "NVIDIA",
    description: "Быстрые ответы с переключаемым режимом рассуждений.",
    group: "fast",
    supportsVision: false,
    supportsVideo: false,
    isFree: true,
    priority: 310,
    recommended: false,
    enabled: true,
  },
  {
    id: "inclusionai/ling-3.0-tiny:free",
    title: "Ling 3.0 Tiny",
    provider: "InclusionAI",
    description: "Повседневный диалог, выполнение инструкций и быстрые ответы.",
    group: "fast",
    supportsVision: false,
    supportsVideo: false,
    isFree: true,
    priority: 320,
    recommended: false,
    enabled: true,
  },
  {
    id: "liquid/lfm-2.5-2.6b:free",
    title: "LFM2.5 2.6B",
    provider: "Liquid AI",
    description: "Извлечение данных, RAG и компактная работа с длинным контекстом.",
    group: "fast",
    supportsVision: false,
    supportsVideo: false,
    isFree: true,
    priority: 330,
    recommended: false,
    enabled: true,
  },
  {
    id: "nvidia/nemotron-3.5-content-safety:free",
    title: "Nemotron 3.5 Content Safety",
    provider: "NVIDIA",
    description: "Проверка безопасности текста и изображений; не для обычного диалога.",
    group: "specialized",
    supportsVision: true,
    supportsVideo: false,
    isFree: true,
    priority: 400,
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
