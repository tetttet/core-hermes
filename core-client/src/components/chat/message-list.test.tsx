import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "@/types/chat";
import { MessageList } from "./message-list";

const messages: ChatMessage[] = [
  {
    id: "user-1",
    role: "user",
    content: "Вопрос",
    createdAt: Date.parse("2026-08-11T08:30:00.000Z"),
  },
  {
    id: "assistant-1",
    role: "assistant",
    content: "Полезный **ответ**",
    modelId: "google/gemma-4-26b-a4b-it:free",
  },
];

describe("MessageList", () => {
  afterEach(cleanup);

  it("shows a history skeleton instead of an empty-chat prompt", () => {
    const { container } = render(
      <MessageList
        messages={[]}
        isLoading={false}
        isHistoryLoading
        progressMessage=""
      />,
    );

    expect(
      screen.getByRole("status", { name: "Загрузка истории чата" }),
    ).toBeDefined();
    expect(
      container
        .querySelector(".empty-chat-title")
        ?.closest("[aria-hidden]")
        ?.getAttribute("aria-hidden"),
    ).toBe("true");
  });

  it("loads older messages only on demand", () => {
    const onLoadOlder = vi.fn();
    render(
      <MessageList
        messages={messages}
        isLoading={false}
        hasOlderMessages
        onLoadOlder={onLoadOlder}
        progressMessage=""
      />,
    );

    expect(onLoadOlder).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Показать ранние сообщения" }),
    );
    expect(onLoadOlder).toHaveBeenCalledOnce();
  });

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

  it("shows compact copy actions and the user message timestamp", async () => {
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
    const userCopyButton = screen.getByRole("button", {
      name: "Копировать сообщение",
    });
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(document.querySelector("time")?.getAttribute("datetime")).toBe(
      "2026-08-11T08:30:00.000Z",
    );
    fireEvent.click(copyButton);

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("Полезный **ответ**"),
    );
    expect(
      screen.getByRole("button", { name: "Скопировано ответ" }),
    ).toBeDefined();

    fireEvent.click(userCopyButton);
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith("Вопрос"));
    expect(
      screen.getByRole("button", { name: "Скопировано сообщение" }),
    ).toBeDefined();
  });
});
