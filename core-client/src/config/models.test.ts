import { describe, expect, it } from "vitest";
import { AUTO_MODEL_ID, MODEL_CATALOG, MODELS, getModelReasoning } from "./models";

const AUDITED_OPENROUTER_FREE_MODEL_IDS = [
  "inclusionai/ling-3.0-flash-fin:free",
  "dots-studio/dots-3-note-preview:free",
  "liquid/lfm-2.5-2.6b:free",
  "nvidia/nemotron-3.5-lightning:free",
  "thinkingmachines/inkling-small:free",
  "poolside/laguna-s-2.1:free",
  "thinkingmachines/inkling:free",
  "poolside/laguna-xs-2.1:free",
  "cohere/north-mini-code:free",
  "z-ai/glm-5.2:free",
  "nvidia/nemotron-3.5-content-safety:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "minimax/minimax-m3:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
  "minimax/minimax-m2.7:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
] as const;

describe("model catalog", () => {
  it("contains the audited OpenRouter free-model catalog", () => {
    const configuredIds = MODEL_CATALOG.filter((model) => model.id !== AUTO_MODEL_ID)
      .map((model) => model.id)
      .sort();

    expect(configuredIds).toEqual([...AUDITED_OPENROUTER_FREE_MODEL_IDS].sort());
  });

  it("assigns every selectable model to a semantic group", () => {
    expect(MODELS.every((model) => Boolean(model.group))).toBe(true);
  });

  it("keeps the public catalog concrete, free, and explicit about known licenses", () => {
    const apiModels = MODELS.filter((model) => model.id !== AUTO_MODEL_ID);

    expect(apiModels.every((model) => model.id.endsWith(":free"))).toBe(true);
    expect(apiModels.every((model) => model.isFree)).toBe(true);
    expect(
      apiModels.every(
        (model) =>
          model.license === null ||
          (Boolean(model.license.name) && model.license.url.startsWith("https://")),
      ),
    ).toBe(true);
    expect(apiModels.some((model) => model.id === "openrouter/free")).toBe(false);
  });

  it("enables required reasoning for the free models that reject its exclusion", () => {
    for (const modelId of [
      "inclusionai/ling-3.0-flash-fin:free",
      "liquid/lfm-2.5-2.6b:free",
      "minimax/minimax-m2.7:free",
    ]) {
      expect(getModelReasoning(modelId)).toEqual({ effort: "medium", exclude: false });
    }
  });

  it("does not offer models that OpenRouter restricts to agent harnesses or moderation", () => {
    expect(MODELS.map((model) => model.id)).not.toEqual(
      expect.arrayContaining([
        "thinkingmachines/inkling:free",
        "thinkingmachines/inkling-small:free",
        "nvidia/nemotron-3.5-content-safety:free",
      ]),
    );
  });
});
