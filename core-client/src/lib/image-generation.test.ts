import { describe, expect, it, vi } from "vitest";
import {
  buildHordeGenerationPayload,
  getImageModel,
  MAX_IMAGE_SEED,
} from "./image-generation";

describe("buildHordeGenerationPayload", () => {
  it("uses the selected free model and disables public sharing", () => {
    const result = buildHordeGenerationPayload({
      prompt: "Тихая улица после дождя",
      model: "Dreamshaper",
      style: "cinematic",
      aspectRatio: "16:9",
      quality: "high",
      seed: "42",
    });

    expect(result.payload.models).toEqual(["Dreamshaper"]);
    expect(result.payload.shared).toBe(false);
    expect(result.payload.nsfw).toBe(false);
    expect(result.payload.params).toMatchObject({
      width: 768,
      height: 448,
      steps: 28,
      seed: "42",
    });
    expect(result.payload.prompt).toContain("cinematic lighting");
  });

  it("exposes the anonymous Pollinations model as a separate free provider", () => {
    expect(getImageModel("pollinations_flux")).toMatchObject({
      provider: "pollinations",
      apiModelId: "dreamshaper",
      anonymousApiModelId: "sana",
    });
  });

  it("keeps automatically generated seeds inside the Pollinations range", () => {
    const now = 1_786_690_000_000;
    const dateSpy = vi.spyOn(Date, "now").mockReturnValue(now);

    const result = buildHordeGenerationPayload({
      prompt: "Тихая улица после дождя",
      model: "pollinations_flux",
      style: "none",
      aspectRatio: "1:1",
      quality: "standard",
    });

    expect(result.seed).toBe(String(now % (MAX_IMAGE_SEED + 1)));
    expect(Number(result.seed)).toBeLessThanOrEqual(MAX_IMAGE_SEED);
    dateSpy.mockRestore();
  });
});
