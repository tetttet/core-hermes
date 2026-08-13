import { describe, expect, it } from "vitest";
import { AUTO_MODEL_ID, MODELS } from "./models";

const OPENROUTER_FREE_MODEL_IDS = [
  "liquid/lfm-2.5-2.6b:free",
  "nvidia/nemotron-3.5-lightning:free",
  "inclusionai/ling-3.0-tiny:free",
  "poolside/laguna-s-2.1:free",
  "poolside/laguna-xs-2.1:free",
  "cohere/north-mini-code:free",
  "nvidia/nemotron-3.5-content-safety:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "openrouter/free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "nvidia/nemotron-nano-12b-v2-vl:free",
  "nvidia/nemotron-nano-9b-v2:free",
  "openai/gpt-oss-20b:free",
] as const;

describe("model catalog", () => {
  it("contains the complete OpenRouter free-model catalog", () => {
    const configuredIds = MODELS.filter((model) => model.id !== AUTO_MODEL_ID)
      .map((model) => model.id)
      .sort();

    expect(configuredIds).toEqual([...OPENROUTER_FREE_MODEL_IDS].sort());
  });

  it("assigns every selectable model to a semantic group", () => {
    expect(MODELS.every((model) => Boolean(model.group))).toBe(true);
  });
});
