import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "@/types/chat";
import { MessageList } from "./message-list";

const messages: ChatMessage[] = [
  {
    id: "user-1",
    role: "user",
    content: "Вопрос",
  },
  {
    id: "assistant-1",
    role: "assistant",
    content: "Полезный **ответ**",
    modelId: "google/gemma-4-26b-a4b-it:free",
  },
];

describe("MessageList", () => {
  it("shows the Yahya logo while the assistant is thinking", () => {
    const { container } = render(
      <MessageList
        messages={[
          {
            id: "assistant-streaming",
            role: "assistant",
            content: "",
            status: "streaming",
          },
        ]}
        isLoading
        progressMessage=""
      />,
    );

    expect(screen.getByRole("status", { name: "Hermes думает" })).toBeDefined();
    expect(container.querySelector('.typing-logo[src="/yahya.svg"]')).not.toBeNull();
  });

  it("hides model identity and shows a compact copy action only for bot messages", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <MessageList messages={messages} isLoading={false} progressMessage="" />,
    );

    expect(screen.queryByText(/Модель:/)).toBeNull();
    expect(screen.queryByText(/Gemma/)).toBeNull();

    const copyButton = screen.getByRole("button", { name: "Копировать ответ" });
    expect(screen.getAllByRole("button")).toHaveLength(1);
    fireEvent.click(copyButton);

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("Полезный **ответ**"),
    );
    expect(
      screen.getByRole("button", { name: "Скопировано ответ" }),
    ).toBeDefined();
  });
});
