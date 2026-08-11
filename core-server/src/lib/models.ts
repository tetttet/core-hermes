import type { AttachmentKind } from "./chat-input.js";

export const AUTO_MODEL_ID = "hermes/auto-vision-safe";
export const OPENROUTER_FREE_MODEL_ID = "openrouter/free";
export const VISION_FALLBACK_MODEL_IDS = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "nvidia/nemotron-nano-12b-v2-vl:free",
  OPENROUTER_FREE_MODEL_ID,
] as const;

const MODELS = [
  { id: AUTO_MODEL_ID, image: true, video: true },
  { id: "google/gemma-4-31b-it:free", image: true, video: false },
  { id: "google/gemma-4-26b-a4b-it:free", image: true, video: true },
  { id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", image: true, video: true },
  { id: "nvidia/nemotron-nano-12b-v2-vl:free", image: true, video: true },
  { id: OPENROUTER_FREE_MODEL_ID, image: true, video: false },
  { id: "nvidia/nemotron-3-ultra-550b-a55b:free", image: false, video: false },
  { id: "inclusionai/ling-3.0-flash:free", image: false, video: false },
  { id: "poolside/laguna-s-2.1:free", image: false, video: false },
  { id: "nvidia/nemotron-3-super-120b-a12b:free", image: false, video: false },
] as const;

export function isSupportedModel(modelId: string) {
  return MODELS.some((model) => model.id === modelId);
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
  const fallbacks = VISION_FALLBACK_MODEL_IDS.filter(acceptsAll);
  if (selectedModelId === AUTO_MODEL_ID) return [...fallbacks];
  if (!acceptsAll(selectedModelId)) return [];
  if (!allowFallback || required.length === 0) return [selectedModelId];
  return [selectedModelId, ...fallbacks.filter((modelId) => modelId !== selectedModelId)];
}
