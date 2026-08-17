import { describe, expect, it } from "vitest";
import {
  AUTO_MODEL_ID,
  TEXT_FALLBACK_MODEL_IDS,
  VISION_FALLBACK_MODEL_IDS,
  modelAccepts,
} from "@/config/models";
import { resolveModelRoute } from "./model-router";

describe("resolveModelRoute", () => {
  it("uses the verified text allowlist for Auto without attachments", () => {
    const route = resolveModelRoute({
      selectedModelId: AUTO_MODEL_ID,
      attachmentKinds: [],
      allowFallback: true,
    });

    expect(route.candidates).toEqual([...TEXT_FALLBACK_MODEL_IDS]);
  });

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

    expect(route.candidates).not.toContain("openrouter/free");
    expect(route.candidates.every((modelId) => modelAccepts(modelId, "video"))).toBe(
      true,
    );
  });

  it("retries a manual vision model first and can disable cross-model fallback", () => {
    const selectedModelId = "google/gemma-4-26b-a4b-it:free";
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

  it("falls back from a manual text model when fallback is enabled", () => {
    const selectedModelId = "poolside/laguna-s-2.1:free";
    const route = resolveModelRoute({
      selectedModelId,
      attachmentKinds: [],
      allowFallback: true,
    });

    expect(route.candidates).toEqual([
      selectedModelId,
      ...TEXT_FALLBACK_MODEL_IDS,
    ]);
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
