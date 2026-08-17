import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfilePage } from "./profile-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

const generatedImage = {
  id: "image-1",
  dataUrl: "data:image/webp;base64,AA==",
  mimeType: "image/webp",
  prompt: "Кинематографичный город",
  model: "stable_diffusion",
  style: "cinematic",
  aspectRatio: "1:1",
  quality: "standard",
  seed: "42",
  resolution: "512×512",
  createdAt: 1,
};

describe("ProfilePage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      "hermes-generated-images-v1",
      JSON.stringify([generatedImage]),
    );
  });

  afterEach(cleanup);

  it("keeps the paused image-generation UI hidden without deleting local data", () => {
    render(<ProfilePage />);

    expect(screen.queryByRole("tab", { name: /Изображения/ })).toBeNull();
    expect(screen.queryByText(generatedImage.prompt)).toBeNull();
    expect(window.localStorage.getItem("hermes-generated-images-v1")).toContain(
      generatedImage.id,
    );
  });
});
