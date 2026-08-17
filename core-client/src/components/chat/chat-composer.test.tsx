import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTO_MODEL_ID } from "@/config/models";
import { ChatComposer } from "./chat-composer";

describe("ChatComposer", () => {
  afterEach(cleanup);

  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });
  });

  it("shows a clear AI accuracy notice below the input", () => {
    render(
      <ChatComposer
        modelId={AUTO_MODEL_ID}
        modelLocked={false}
        onModelChange={vi.fn()}
        onSend={vi.fn()}
        onStop={vi.fn()}
        isLoading={false}
      />,
    );

    const notice = screen.getByRole("link", {
      name: "Hermes — ИИ и может ошибаться. Проверяйте важную информацию.",
    });
    expect(notice.getAttribute("href")).toBe("/help");
  });

  it("accepts a file dropped anywhere and opens its preview", async () => {
    render(
      <ChatComposer
        modelId={AUTO_MODEL_ID}
        modelLocked={false}
        onModelChange={vi.fn()}
        onSend={vi.fn()}
        onStop={vi.fn()}
        isLoading={false}
      />,
    );

    const file = new File(["image"], "example.png", { type: "image/png" });
    const dataTransfer = {
      types: ["Files"],
      files: [file],
      dropEffect: "none",
    } as unknown as DataTransfer;

    fireEvent.dragEnter(window, { dataTransfer });
    expect(screen.getByText("Отпустите файл")).toBeDefined();

    fireEvent.drop(window, { dataTransfer });
    const previewButton = await screen.findByRole("button", {
      name: "Открыть example.png",
    });
    expect(screen.queryByText("example.png")).toBeNull();

    fireEvent.click(previewButton);
    expect(
      screen.getByRole("dialog", { name: "Просмотр example.png" }),
    ).toBeDefined();
  });

  it("keeps internet search off by default and sends the enabled flag", () => {
    const onSend = vi.fn();
    render(
      <ChatComposer
        modelId={AUTO_MODEL_ID}
        modelLocked={false}
        onModelChange={vi.fn()}
        onSend={onSend}
        onStop={vi.fn()}
        isLoading={false}
      />,
    );

    const internetButton = screen.getByRole("button", {
      name: "Интернет-поиск",
    });
    expect(internetButton.getAttribute("aria-pressed")).toBe("false");
    expect(internetButton.querySelector("svg")).not.toBeNull();
    expect(internetButton.textContent).toBe("Интернет");

    const messageInput = screen.getByRole("textbox", { name: "Сообщение" });
    fireEvent.change(messageInput, {
      target: { value: "Обычный вопрос" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Отправить" }));
    expect(onSend).toHaveBeenNthCalledWith(1, "Обычный вопрос", [], false);

    fireEvent.click(internetButton);
    expect(internetButton.getAttribute("aria-pressed")).toBe("true");
    fireEvent.change(messageInput, {
      target: { value: "Что произошло сегодня?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Отправить" }));

    expect(onSend).toHaveBeenNthCalledWith(
      2,
      "Что произошло сегодня?",
      [],
      true,
    );
  });
});
