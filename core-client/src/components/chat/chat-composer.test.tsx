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
});
