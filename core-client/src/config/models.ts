export type AttachmentKind = "image" | "video";

export type ModelGroup =
  | "universal"
  | "vision"
  | "coding"
  | "reasoning"
  | "fast";

export type ModelLicense = {
  name: string;
  url: string;
};

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
  license: ModelLicense | null;
};

export const MODEL_LICENSES = {
  apache: {
    name: "Apache 2.0",
    url: "https://www.apache.org/licenses/LICENSE-2.0",
  },
  gemmaApache: {
    name: "Apache 2.0 · Gemma",
    url: "https://ai.google.dev/gemma/apache_2",
  },
  openMdw: {
    name: "OpenMDW 1.1",
    url: "https://openmdw.ai/license/1-1/",
  },
  nvidiaOpenModelAgreement: {
    name: "NVIDIA Open Model Agreement",
    url: "https://www.nvidia.com/en-us/agreements/enterprise-software/nvidia-open-model-agreement/",
  },
  nvidiaNemotron: {
    name: "NVIDIA Nemotron Open Model License",
    url: "https://www.nvidia.com/en-us/agreements/enterprise-software/nvidia-nemotron-open-model-license/",
  },
  nvidiaOpenModel: {
    name: "NVIDIA Open Model License",
    url: "https://www.nvidia.com/en-us/agreements/enterprise-software/nvidia-open-model-license/",
  },
} as const satisfies Record<string, ModelLicense>;

// Локальный ID: он никогда не отправляется в OpenRouter как имя модели.
export const AUTO_MODEL_ID = "hermes/auto-vision-safe";

// В Auto используем только модели, которые прошли реальную проверку API.
export const VISION_FALLBACK_MODEL_IDS = [
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
] as const;

export const TEXT_FALLBACK_MODEL_IDS = [
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "openai/gpt-oss-20b:free",
] as const;

export function getModelReasoning(modelId: string) {
  const effort = modelId === "openai/gpt-oss-20b:free" ? "low" : "none";

  return {
    effort,
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
    license: null,
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
    license: MODEL_LICENSES.gemmaApache,
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
    license: MODEL_LICENSES.nvidiaOpenModelAgreement,
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
    license: MODEL_LICENSES.openMdw,
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
    license: MODEL_LICENSES.nvidiaNemotron,
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
    license: MODEL_LICENSES.nvidiaNemotron,
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
    license: MODEL_LICENSES.apache,
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
    license: MODEL_LICENSES.openMdw,
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
    license: MODEL_LICENSES.openMdw,
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
    license: MODEL_LICENSES.apache,
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
    license: MODEL_LICENSES.openMdw,
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
    license: MODEL_LICENSES.nvidiaOpenModel,
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
