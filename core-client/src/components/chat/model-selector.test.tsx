import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AUTO_MODEL_ID, MODELS } from "@/config/models";
import { ModelSelector } from "./model-selector";

describe("ModelSelector", () => {
  afterEach(cleanup);

  it("keeps the main menu compact and groups models in a secondary menu", () => {
    const onChange = vi.fn();
    const featuredModels = MODELS.filter((model) => model.recommended);

    render(<ModelSelector value={AUTO_MODEL_ID} onChange={onChange} />);

    expect(screen.queryByRole("combobox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Авто/ }));

    expect(featuredModels).toHaveLength(3);
    expect(screen.getByText("Сам выберет лучшую модель")).toBeDefined();
    expect(screen.getByText("Быстрый анализ фото и видео")).toBeDefined();
    expect(screen.getByText("Сложные визуальные задачи")).toBeDefined();
    expect(screen.queryByText("Универсальные")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Другие модели/ }));

    expect(screen.queryByText("Универсальные")).toBeNull();
    expect(screen.queryByText("Фото и видео")).toBeNull();
    expect(screen.getByText("Код и разработка")).toBeDefined();
    expect(screen.getByText("Глубокое мышление")).toBeDefined();
    expect(screen.getByText("Быстрые и компактные")).toBeDefined();
    expect(screen.queryByText("Специальные")).toBeNull();

    const codingModelDescription = screen.getByText("Агентное программирование");
    expect(codingModelDescription).toBeDefined();

    fireEvent.click(codingModelDescription);
    expect(onChange).toHaveBeenCalledWith("cohere/north-mini-code:free");
  });
});
