import { describe, expect, it } from "vitest";
import { AUTO_MODEL_ID, MODELS } from "./models";

const AUDITED_OPENROUTER_FREE_MODEL_IDS = [
  "nvidia/nemotron-3.5-lightning:free",
  "poolside/laguna-s-2.1:free",
  "poolside/laguna-xs-2.1:free",
  "cohere/north-mini-code:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "nvidia/nemotron-nano-9b-v2:free",
  "openai/gpt-oss-20b:free",
] as const;

describe("model catalog", () => {
  it("contains the audited OpenRouter free-model catalog", () => {
    const configuredIds = MODELS.filter((model) => model.id !== AUTO_MODEL_ID)
      .map((model) => model.id)
      .sort();

    expect(configuredIds).toEqual([...AUDITED_OPENROUTER_FREE_MODEL_IDS].sort());
  });

  it("assigns every selectable model to a semantic group", () => {
    expect(MODELS.every((model) => Boolean(model.group))).toBe(true);
  });

  it("keeps the public catalog concrete, free and license-audited", () => {
    const apiModels = MODELS.filter((model) => model.id !== AUTO_MODEL_ID);

    expect(apiModels.every((model) => model.id.endsWith(":free"))).toBe(true);
    expect(apiModels.every((model) => model.isFree)).toBe(true);
    expect(apiModels.every((model) => Boolean(model.license))).toBe(true);
    expect(apiModels.some((model) => model.id === "openrouter/free")).toBe(false);
  });
});
