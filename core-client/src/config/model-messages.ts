import type { ModelOption } from "@/config/models";

const DESCRIPTION_KEYS: Record<string, string> = {
  "hermes/auto-vision-safe": "auto",
  "google/gemma-4-26b-a4b-it:free": "gemma",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free": "omni",
  "nvidia/nemotron-3-ultra-550b-a55b:free": "ultra",
  "nvidia/nemotron-3-super-120b-a12b:free": "super",
  "nvidia/nemotron-3-nano-30b-a3b:free": "nano30",
  "openai/gpt-oss-20b:free": "gptOss",
  "poolside/laguna-s-2.1:free": "lagunaS",
  "poolside/laguna-xs-2.1:free": "lagunaXs",
  "cohere/north-mini-code:free": "north",
  "nvidia/nemotron-3.5-lightning:free": "lightning",
  "nvidia/nemotron-nano-9b-v2:free": "nano9"
};

export function getModelDescriptionKey(modelId: string) {
  return DESCRIPTION_KEYS[modelId] ?? "auto";
}

export function getModelCapabilityKey(model: ModelOption) {
  if (model.supportsVideo) return "capabilityPhotoVideo";
  if (model.supportsVision) return "capabilityPhoto";
  return "capabilityText";
}
