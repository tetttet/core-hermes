export const IMAGE_MODELS = [
  {
    id: "stable_diffusion",
    name: "Stable Diffusion",
    description: "Универсальная модель для большинства задач",
    provider: "horde",
    apiModelId: "stable_diffusion",
  },
  {
    id: "Dreamshaper",
    name: "DreamShaper",
    description: "Выразительные концепты и художественные сцены",
    provider: "horde",
    apiModelId: "Dreamshaper",
  },
  {
    id: "Realistic Vision",
    name: "Realistic Vision",
    description: "Фотореалистичные портреты и предметные кадры",
    provider: "horde",
    apiModelId: "Realistic Vision",
  },
  {
    id: "Anything v5",
    name: "Anything v5",
    description: "Иллюстрации, аниме и стилизованные персонажи",
    provider: "horde",
    apiModelId: "Anything v5",
  },
  {
    id: "pollinations_flux",
    name: "Pollinations · Flux",
    description: "Быстрая бесплатная генерация без очереди AI Horde",
    provider: "pollinations",
    apiModelId: "flux",
  },
] as const;

export const IMAGE_STYLES = [
  { id: "none", name: "Без стиля" },
  { id: "cinematic", name: "Кинематографичный" },
  { id: "photoreal", name: "Фотореализм" },
  { id: "editorial", name: "Editorial" },
  { id: "minimal", name: "Минимализм" },
  { id: "3d", name: "3D-рендер" },
] as const;

export const IMAGE_ASPECT_RATIOS = [
  { id: "1:1", name: "Квадрат", width: 512, height: 512 },
  { id: "4:5", name: "Портрет", width: 512, height: 640 },
  { id: "16:9", name: "Альбом", width: 768, height: 448 },
  { id: "9:16", name: "История", width: 448, height: 768 },
] as const;

export type ImageModelId = (typeof IMAGE_MODELS)[number]["id"];
export type ImageStyleId = (typeof IMAGE_STYLES)[number]["id"];
export type ImageAspectRatio = (typeof IMAGE_ASPECT_RATIOS)[number]["id"];
export type ImageQuality = "standard" | "high";

export type GenerateImageRequest = {
  prompt: string;
  model: ImageModelId;
  style: ImageStyleId;
  aspectRatio: ImageAspectRatio;
  quality: ImageQuality;
  seed?: string;
};

export type ImageGenerationStartResponse =
  | {
      state: "queued";
      requestId: string;
      seed: string;
      resolution: string;
      statusMessage: string;
    }
  | {
      state: "done";
      seed: string;
      resolution: string;
      statusMessage: string;
      imageDataUrl: string;
      mimeType: string;
    };

export type ImageGenerationPollResponse =
  | {
      state: "waiting" | "generating";
      statusMessage: string;
      queuePosition?: number;
      waitTimeSeconds?: number;
    }
  | {
      state: "done";
      statusMessage: string;
      imageDataUrl: string;
      mimeType: string;
      seed?: string;
    }
  | {
      state: "failed";
      statusMessage: string;
      error: string;
    };

export type ImageGenerationErrorResponse = {
  error: string;
};

const STYLE_DIRECTIONS: Record<ImageStyleId, string> = {
  none: "",
  cinematic:
    "cinematic lighting, dramatic composition, layered depth, refined color grading",
  photoreal:
    "photorealistic, natural materials, realistic lighting, lifelike fine details",
  editorial:
    "premium editorial photography, magazine-ready composition, refined styling",
  minimal:
    "minimal visual language, elegant negative space, restrained palette, clean composition",
  "3d": "high-end 3D render, crisp materials, studio lighting, polished surfaces",
};

export function isImageModelId(value: unknown): value is ImageModelId {
  return IMAGE_MODELS.some((model) => model.id === value);
}

export function getImageModel(modelId: ImageModelId) {
  return IMAGE_MODELS.find((model) => model.id === modelId) ?? IMAGE_MODELS[0];
}

export function isImageStyleId(value: unknown): value is ImageStyleId {
  return IMAGE_STYLES.some((style) => style.id === value);
}

export function isImageAspectRatio(value: unknown): value is ImageAspectRatio {
  return IMAGE_ASPECT_RATIOS.some((ratio) => ratio.id === value);
}

export function buildHordeGenerationPayload(request: GenerateImageRequest) {
  const dimensions =
    IMAGE_ASPECT_RATIOS.find((ratio) => ratio.id === request.aspectRatio) ??
    IMAGE_ASPECT_RATIOS[0];
  const seed = request.seed?.trim() || String(Date.now());
  const styleDirection = STYLE_DIRECTIONS[request.style];
  const prompt = [request.prompt.trim(), styleDirection]
    .filter(Boolean)
    .join(". ");

  return {
    payload: {
      prompt,
      params: {
        width: dimensions.width,
        height: dimensions.height,
        steps: request.quality === "high" ? 28 : 20,
        cfg_scale: 7.5,
        sampler_name: "k_euler_a",
        n: 1,
        seed,
      },
      models: [getImageModel(request.model).apiModelId],
      nsfw: false,
      censor_nsfw: true,
      trusted_workers: false,
      validated_backends: true,
      slow_workers: true,
      r2: false,
      shared: false,
      replacement_filter: true,
      allow_downgrade: true,
    },
    seed,
    resolution: `${dimensions.width}×${dimensions.height}`,
  };
}
