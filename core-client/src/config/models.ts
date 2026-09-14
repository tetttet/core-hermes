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

// В режиме «Авто» используем только модели, которые прошли реальную проверку API.
export const VISION_FALLBACK_MODEL_IDS = [
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "minimax/minimax-m3:free",
] as const;

export const TEXT_FALLBACK_MODEL_IDS = [
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nvidia/nemotron-3.5-lightning:free",
] as const;

const MANDATORY_REASONING_MODEL_IDS = new Set([
  "inclusionai/ling-3.0-flash-fin:free",
  "liquid/lfm-2.5-2.6b:free",
  "minimax/minimax-m2.7:free",
]);

export function getModelReasoning(modelId: string) {
  const requiresReasoning = MANDATORY_REASONING_MODEL_IDS.has(modelId);
  return {
    effort: requiresReasoning ? "medium" : "none",
    exclude: !requiresReasoning,
  } as const;
}

// Единый каталог для селекторов, server-side validation и маршрутизации.
export const MODEL_CATALOG = [
  {
    id: AUTO_MODEL_ID,
    title: "Авто · Безопасный выбор",
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
    id: "minimax/minimax-m3:free",
    title: "MiniMax M3",
    provider: "MiniMax",
    description: "Агентные задачи, разработка и анализ фото или видео с длинным контекстом.",
    group: "vision",
    supportsVision: true,
    supportsVideo: true,
    isFree: true,
    priority: 40,
    recommended: false,
    enabled: true,
    license: null,
  },
  {
    id: "google/gemma-4-31b-it:free",
    title: "Gemma 4 31B",
    provider: "Google",
    description: "Мультимодальная модель для фото, видео, рассуждений и вызова инструментов.",
    group: "vision",
    supportsVision: true,
    supportsVideo: true,
    isFree: true,
    priority: 50,
    recommended: false,
    enabled: true,
    license: MODEL_LICENSES.gemmaApache,
  },
  {
    id: "dots-studio/dots-3-note-preview:free",
    title: "Dots3-Note Preview",
    provider: "Dots Studio",
    description: "Визуальные задачи, структурированные ответы и контекст до 512 тысяч токенов.",
    group: "vision",
    supportsVision: true,
    supportsVideo: false,
    isFree: true,
    priority: 60,
    recommended: false,
    enabled: true,
    license: null,
  },
  {
    id: "thinkingmachines/inkling:free",
    title: "Inkling",
    provider: "Thinking Machines",
    description: "Сложные агентные задачи, код, фото и аудио с контекстом до миллиона токенов.",
    group: "vision",
    supportsVision: true,
    supportsVideo: false,
    isFree: true,
    priority: 70,
    recommended: false,
    // OpenRouter разрешает эту модель только зарегистрированным агентным приложениям.
    enabled: false,
    license: null,
  },
  {
    id: "thinkingmachines/inkling-small:free",
    title: "Inkling Small",
    provider: "Thinking Machines",
    description: "Более компактная мультимодальная модель для фото, аудио и инструментов.",
    group: "vision",
    supportsVision: true,
    supportsVideo: false,
    isFree: true,
    priority: 80,
    recommended: false,
    // OpenRouter разрешает эту модель только зарегистрированным агентным приложениям.
    enabled: false,
    license: null,
  },
  {
    id: "nvidia/nemotron-3.5-content-safety:free",
    title: "Nemotron Content Safety",
    provider: "NVIDIA",
    description: "Проверка безопасности текстов и изображений для модерации контента.",
    group: "vision",
    supportsVision: true,
    supportsVideo: false,
    isFree: true,
    priority: 90,
    recommended: false,
    // Это модель модерации: в обычном чате она возвращает только классификацию безопасности.
    enabled: false,
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
    priority: 300,
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
    priority: 310,
    recommended: false,
    enabled: true,
    license: MODEL_LICENSES.nvidiaNemotron,
  },
  {
    id: "z-ai/glm-5.2:free",
    title: "GLM 5.2",
    provider: "Z.ai",
    description: "Глубокие рассуждения, разработка и агентные сценарии с длинным контекстом.",
    group: "reasoning",
    supportsVision: false,
    supportsVideo: false,
    isFree: true,
    priority: 320,
    recommended: false,
    enabled: true,
    license: null,
  },
  {
    id: "minimax/minimax-m2.7:free",
    title: "MiniMax M2.7",
    provider: "MiniMax",
    description: "Агентные сценарии, работа с инструментами и повседневные задачи разработки.",
    group: "reasoning",
    supportsVision: false,
    supportsVideo: false,
    isFree: true,
    priority: 330,
    recommended: false,
    enabled: true,
    license: null,
  },
  {
    id: "inclusionai/ling-3.0-flash-fin:free",
    title: "Ling 3.0 Flash Fin",
    provider: "InclusionAI",
    description: "Финансовый анализ, инструменты и длинный контекст для текстовых задач.",
    group: "reasoning",
    supportsVision: false,
    supportsVideo: false,
    isFree: true,
    priority: 340,
    recommended: false,
    enabled: true,
    license: null,
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
    priority: 400,
    recommended: false,
    enabled: true,
    license: MODEL_LICENSES.openMdw,
  },
  {
    id: "liquid/lfm-2.5-2.6b:free",
    title: "LFM2.5 2.6B",
    provider: "Liquid AI",
    description: "Быстрая обработка данных, извлечение фактов и длинный контекст.",
    group: "fast",
    supportsVision: false,
    supportsVideo: false,
    isFree: true,
    priority: 410,
    recommended: false,
    enabled: true,
    license: null,
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
