import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GenerationStudio } from "./generation-studio";

const storedImage = {
  id: "image-1",
  dataUrl: "data:image/webp;base64,AA==",
  mimeType: "image/webp",
  prompt: "Кинематографичный город после дождя",
  model: "Dreamshaper",
  style: "cinematic",
  aspectRatio: "16:9",
  quality: "high",
  seed: "42",
  resolution: "768×448",
  createdAt: 1,
};

describe("GenerationStudio", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the chat workspace, history and bottom composer", async () => {
    render(<GenerationStudio />);

    expect(screen.getByRole("complementary", { name: "История генераций" })).toBeDefined();
    expect(screen.getByRole("region", { name: "Диалог генерации" })).toBeDefined();
    expect(screen.getByLabelText("Промпт")).toBeDefined();
    expect(screen.getByRole("button", { name: /Модель: Stable Diffusion/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Формат: 1:1/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Стиль: Без стиля/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Качество: Стандарт/ })).toBeDefined();
    expect(screen.queryByText("Один диалог · локальная история")).toBeNull();
    expect(
      (screen.getByRole("button", { name: "Создать изображение" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Представьте.*Создайте/ })).toBeDefined();
      expect(screen.getByText("История пока пуста")).toBeDefined();
    });
  });

  it("changes model and aspect ratio inside the composer", () => {
    render(<GenerationStudio />);

    fireEvent.click(screen.getByRole("button", { name: /Модель: Stable Diffusion/ }));
    fireEvent.click(screen.getByRole("option", { name: /DreamShaper/ }));
    expect(screen.getByRole("button", { name: /Модель: DreamShaper/ })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Модель: DreamShaper/ }));
    fireEvent.click(screen.getByRole("option", { name: /Pollinations · Flux/ }));
    expect(screen.getByRole("button", { name: /Модель: Pollinations · Flux/ })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Формат: 1:1/ }));
    fireEvent.click(screen.getByRole("option", { name: /16:9 · Альбом/ }));
    expect(screen.getByRole("button", { name: /Формат: 16:9 · Альбом/ })).toBeDefined();
  });

  it("shows an API error inside the workspace without alert dialogs", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ error: "Сервис временно недоступен." }, { status: 503 }),
    );
    const alertSpy = vi.spyOn(window, "alert");
    render(<GenerationStudio />);

    fireEvent.change(screen.getByLabelText("Промпт"), {
      target: { value: "Тихая улица после дождя" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Создать изображение" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(
        "Сервис временно недоступен.",
      );
    });
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("opens a stored result, reuses its settings, and confirms history clearing", async () => {
    window.localStorage.setItem(
      "hermes-generated-images-v1",
      JSON.stringify([storedImage]),
    );
    render(<GenerationStudio />);

    const openButton = await screen.findByRole("button", {
      name: "Открыть изображение на весь экран",
    });
    fireEvent.click(openButton);

    expect(screen.getByRole("dialog", { name: "Изображение" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Повторить настройки/ }));
    expect((screen.getByLabelText("Промпт") as HTMLTextAreaElement).value).toBe(
      storedImage.prompt,
    );

    fireEvent.click(screen.getByRole("button", { name: "Очистить историю" }));
    const clearDialog = screen.getByRole("alertdialog", {
      name: "Очистить локальную историю?",
    });
    fireEvent.click(within(clearDialog).getByRole("button", { name: "Очистить" }));

    await waitFor(() => {
      expect(window.localStorage.getItem("hermes-generated-images-v1")).toBeNull();
      expect(screen.getByText("История пока пуста")).toBeDefined();
    });
  });

  it("collapses history and confirms an individual image deletion", async () => {
    window.localStorage.setItem(
      "hermes-generated-images-v1",
      JSON.stringify([storedImage]),
    );
    const { container } = render(<GenerationStudio />);

    await screen.findByRole("button", { name: "Свернуть историю" });
    fireEvent.click(screen.getByRole("button", { name: "Свернуть историю" }));
    expect(container.querySelector(".generation-studio")?.getAttribute("data-sidebar-collapsed"))
      .toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Развернуть историю" }));

    fireEvent.click(screen.getByRole("button", {
      name: `Удалить изображение «${storedImage.prompt}»`,
    }));
    const deleteDialog = screen.getByRole("alertdialog", {
      name: "Удалить изображение?",
    });
    expect(window.localStorage.getItem("hermes-generated-images-v1")).not.toBeNull();
    fireEvent.click(within(deleteDialog).getByRole("button", { name: "Удалить" }));

    await waitFor(() => {
      expect(window.localStorage.getItem("hermes-generated-images-v1")).toBeNull();
    });
  });
});
