import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("shows locally generated images in a separate profile tab", async () => {
    render(<ProfilePage />);

    fireEvent.click(screen.getByRole("tab", { name: /Изображения/ }));

    expect(screen.getByRole("img", { name: generatedImage.prompt })).toBeDefined();
    expect(screen.getByText(generatedImage.prompt)).toBeDefined();

    fireEvent.click(
      screen.getByRole("button", {
        name: `Удалить изображение «${generatedImage.prompt}»`,
      }),
    );

    await waitFor(() => {
      expect(window.localStorage.getItem("hermes-generated-images-v1")).toBeNull();
      expect(screen.getByText("Здесь пока пусто")).toBeDefined();
    });
  });
});
