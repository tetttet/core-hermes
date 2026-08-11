import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AUTO_MODEL_ID, MODELS } from "@/config/models";
import { ModelSelector } from "./model-selector";

describe("ModelSelector", () => {
  afterEach(cleanup);

  it("shows four featured models and opens the secondary model menu", () => {
    const onChange = vi.fn();
    const featuredModels = MODELS.filter((model) => model.recommended);
    const otherModels = MODELS.filter((model) => !model.recommended);

    render(<ModelSelector value={AUTO_MODEL_ID} onChange={onChange} />);

    expect(screen.queryByRole("combobox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Auto/ }));

    expect(featuredModels).toHaveLength(4);
    expect(screen.getByText("Сам выберет лучшую модель")).toBeDefined();
    expect(screen.getByText("Фото и документы")).toBeDefined();
    expect(screen.getByText("Быстрый анализ фото и видео")).toBeDefined();
    expect(screen.getByText("Сложные визуальные задачи")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Другие модели/ }));
    const otherModelDescription = screen.getByText("Распознавание деталей");
    expect(otherModelDescription).toBeDefined();

    fireEvent.click(otherModelDescription);
    expect(onChange).toHaveBeenCalledWith(otherModels[0].id);
  });
});
