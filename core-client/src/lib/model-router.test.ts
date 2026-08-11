import { describe, expect, it } from "vitest";
import {
  AUTO_MODEL_ID,
  VISION_FALLBACK_MODEL_IDS,
  modelAccepts,
} from "@/config/models";
import { resolveModelRoute } from "./model-router";

describe("resolveModelRoute", () => {
  it("keeps image Auto inside the ordered vision allowlist", () => {
    const route = resolveModelRoute({
      selectedModelId: AUTO_MODEL_ID,
      attachmentKinds: ["image"],
      allowFallback: true,
    });

    expect(route.mode).toBe("auto");
    expect(route.candidates).toEqual([...VISION_FALLBACK_MODEL_IDS]);
    expect(route.candidates.every((modelId) => modelAccepts(modelId, "image"))).toBe(
      true,
    );
  });

  it("removes image-only models from a video route", () => {
    const route = resolveModelRoute({
      selectedModelId: AUTO_MODEL_ID,
      attachmentKinds: ["video"],
      allowFallback: true,
    });

    expect(route.candidates).not.toContain("google/gemma-4-31b-it:free");
    expect(route.candidates).not.toContain("openrouter/free");
    expect(route.candidates.every((modelId) => modelAccepts(modelId, "video"))).toBe(
      true,
    );
  });

  it("retries a manual vision model first and can disable cross-model fallback", () => {
    const selectedModelId = "nvidia/nemotron-nano-12b-v2-vl:free";
    const withFallback = resolveModelRoute({
      selectedModelId,
      attachmentKinds: ["image"],
      allowFallback: true,
    });
    const strict = resolveModelRoute({
      selectedModelId,
      attachmentKinds: ["image"],
      allowFallback: false,
    });

    expect(withFallback.candidates[0]).toBe(selectedModelId);
    expect(withFallback.candidates.length).toBeGreaterThan(1);
    expect(strict.candidates).toEqual([selectedModelId]);
  });

  it("never routes an image into a text-only manual model", () => {
    const route = resolveModelRoute({
      selectedModelId: "nvidia/nemotron-3-ultra-550b-a55b:free",
      attachmentKinds: ["image"],
      allowFallback: true,
    });

    expect(route.candidates).toEqual([]);
  });
});
