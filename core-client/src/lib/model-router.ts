import {
  AUTO_MODEL_ID,
  TEXT_FALLBACK_MODEL_IDS,
  VISION_FALLBACK_MODEL_IDS,
  findModel,
  modelAccepts,
  type AttachmentKind,
} from "@/config/models";

export type ModelRoute = {
  mode: "auto" | "manual";
  candidates: string[];
};

type ResolveModelRouteOptions = {
  selectedModelId: string;
  attachmentKinds: readonly AttachmentKind[];
  allowFallback: boolean;
};

function unique<T>(items: readonly T[]) {
  return [...new Set(items)];
}

function supportsEveryAttachment(
  modelId: string,
  attachmentKinds: readonly AttachmentKind[],
) {
  return attachmentKinds.every((kind) => modelAccepts(modelId, kind));
}

export function resolveModelRoute({
  selectedModelId,
  attachmentKinds,
  allowFallback,
}: ResolveModelRouteOptions): ModelRoute {
  const requiredKinds = unique(attachmentKinds);
  const fallbackModelIds = requiredKinds.length === 0
    ? TEXT_FALLBACK_MODEL_IDS
    : VISION_FALLBACK_MODEL_IDS;
  const compatibleFallbackModels = fallbackModelIds.filter(
    (modelId) =>
      Boolean(findModel(modelId)) &&
      supportsEveryAttachment(modelId, requiredKinds),
  );

  if (selectedModelId === AUTO_MODEL_ID) {
    return { mode: "auto", candidates: compatibleFallbackModels };
  }

  if (!supportsEveryAttachment(selectedModelId, requiredKinds)) {
    return { mode: "manual", candidates: [] };
  }

  if (!allowFallback) {
    return { mode: "manual", candidates: [selectedModelId] };
  }

  return {
    mode: "manual",
    candidates: unique([
      selectedModelId,
      ...compatibleFallbackModels.filter((modelId) => modelId !== selectedModelId),
    ]),
  };
}
