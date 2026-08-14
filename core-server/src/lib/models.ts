import type { AttachmentKind } from "./chat-input.js";

export const AUTO_MODEL_ID = "hermes/auto-vision-safe";
export const OPENROUTER_FREE_MODEL_ID = "openrouter/free";
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

const MODELS = [
  { id: AUTO_MODEL_ID, image: true, video: true },
  { id: "google/gemma-4-31b-it:free", image: true, video: true },
  { id: "google/gemma-4-26b-a4b-it:free", image: true, video: true },
  { id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", image: true, video: true },
  { id: "nvidia/nemotron-nano-12b-v2-vl:free", image: true, video: true },
  { id: OPENROUTER_FREE_MODEL_ID, image: true, video: false },
  { id: "nvidia/nemotron-3-ultra-550b-a55b:free", image: false, video: false },
  { id: "nvidia/nemotron-3-super-120b-a12b:free", image: false, video: false },
  { id: "nvidia/nemotron-3-nano-30b-a3b:free", image: false, video: false },
  { id: "openai/gpt-oss-20b:free", image: false, video: false },
  { id: "poolside/laguna-s-2.1:free", image: false, video: false },
  { id: "poolside/laguna-xs-2.1:free", image: false, video: false },
  { id: "cohere/north-mini-code:free", image: false, video: false },
  { id: "nvidia/nemotron-3.5-lightning:free", image: false, video: false },
  { id: "nvidia/nemotron-nano-9b-v2:free", image: false, video: false },
  { id: "inclusionai/ling-3.0-tiny:free", image: false, video: false },
  { id: "liquid/lfm-2.5-2.6b:free", image: false, video: false },
  { id: "nvidia/nemotron-3.5-content-safety:free", image: true, video: false },
] as const;

const FREE_MODEL_ID = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:-]*:free$/;

export function isSupportedModel(modelId: string) {
  return (
    MODELS.some((model) => model.id === modelId) ||
    (modelId.length <= 120 && FREE_MODEL_ID.test(modelId))
  );
}

export function modelAccepts(modelId: string, kind: AttachmentKind) {
  const model = MODELS.find((candidate) => candidate.id === modelId);
  return Boolean(model?.[kind]);
}

export function resolveModelRoute(
  selectedModelId: string,
  attachmentKinds: readonly AttachmentKind[],
  allowFallback: boolean,
) {
  const required = [...new Set(attachmentKinds)];
  const acceptsAll = (modelId: string) => required.every((kind) => modelAccepts(modelId, kind));
  const fallbackIds = required.length === 0
    ? TEXT_FALLBACK_MODEL_IDS
    : VISION_FALLBACK_MODEL_IDS;
  const fallbacks = fallbackIds.filter(acceptsAll);
  if (selectedModelId === AUTO_MODEL_ID) return [...fallbacks];
  if (!acceptsAll(selectedModelId)) return [];
  if (!allowFallback) return [selectedModelId];
  return [selectedModelId, ...fallbacks.filter((modelId) => modelId !== selectedModelId)];
}
