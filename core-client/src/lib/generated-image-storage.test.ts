import { beforeEach, describe, expect, it } from "vitest";
import {
  clearGeneratedImages,
  loadGeneratedImages,
  saveGeneratedImages,
  type StoredGeneratedImage,
} from "./generated-image-storage";

const image: StoredGeneratedImage = {
  id: "image-1",
  dataUrl: "data:image/webp;base64,AA==",
  mimeType: "image/webp",
  prompt: "Город будущего",
  model: "stable_diffusion",
  style: "cinematic",
  aspectRatio: "1:1",
  quality: "standard",
  seed: "42",
  resolution: "512×512",
  createdAt: 1,
};

describe("generated image storage", () => {
  beforeEach(() => window.localStorage.clear());

  it("keeps generated images only in localStorage", () => {
    expect(saveGeneratedImages([image]).saved).toBe(true);
    expect(loadGeneratedImages()).toEqual([image]);
  });

  it("clears the local gallery", () => {
    saveGeneratedImages([image]);
    expect(clearGeneratedImages()).toBe(true);
    expect(loadGeneratedImages()).toEqual([]);
  });

  it("keeps up to twelve recent images for the generation history", () => {
    const images = Array.from({ length: 14 }, (_, index) => ({
      ...image,
      id: `image-${index}`,
      createdAt: index,
    }));

    const result = saveGeneratedImages(images);

    expect(result.saved).toBe(true);
    expect(result.images).toHaveLength(12);
    expect(loadGeneratedImages()).toHaveLength(12);
  });

  it("ignores malformed persisted data", () => {
    window.localStorage.setItem(
      "hermes-generated-images-v1",
      JSON.stringify([{ ...image, dataUrl: "https://remote.example/image" }]),
    );
    expect(loadGeneratedImages()).toEqual([]);
  });
});
