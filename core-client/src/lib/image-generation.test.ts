import { describe, expect, it } from "vitest";
import { buildHordeGenerationPayload, getImageModel } from "./image-generation";

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

  it("exposes Pollinations Flux as a separate free provider", () => {
    expect(getImageModel("pollinations_flux")).toMatchObject({
      provider: "pollinations",
      apiModelId: "flux",
    });
  });
});
