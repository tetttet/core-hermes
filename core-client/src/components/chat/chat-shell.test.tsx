import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MODEL_ID } from "@/config/models";
import { ChatShell } from "./chat-shell";

const storedChat = {
  activeChatId: "chat-1",
  draftModelId: DEFAULT_MODEL_ID,
  chats: [
    {
      id: "chat-1",
      title: "Рабочий чат",
      modelId: DEFAULT_MODEL_ID,
      messages: [],
      createdAt: 1,
      updatedAt: 1,
    },
  ],
};

describe("ChatShell header actions", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("hermes-chat", JSON.stringify(storedChat));
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
  });

  afterEach(cleanup);

  it("does not show an explore or about link in the chat header", () => {
    const { container } = render(<ChatShell />);

    const header = container.querySelector(".chat-header")!;
    expect(header.querySelector(".chat-header-about")).toBeNull();
    expect(header.textContent).not.toContain("Исследовать");
  });

  it("favorites, renames and deletes the active chat from the chevron menu", async () => {
    const { container } = render(<ChatShell />);

    fireEvent.click(container.querySelector(".chat-header-menu-button")!);
    fireEvent.click(screen.getByRole("menuitem", { name: "В избранное" }));

    await waitFor(() => {
      const saved = JSON.parse(
        window.localStorage.getItem("hermes-chat") ?? "{}",
      );
      expect(saved.chats[0].isFavorite).toBe(true);
      expect(
        container.querySelector('.sidebar-chat[data-favorite="true"]'),
      ).not.toBeNull();
    });

    fireEvent.click(container.querySelector(".chat-header-menu-button")!);
    fireEvent.click(screen.getByRole("menuitem", { name: "Переименовать" }));
    const renameInput = screen.getByRole("textbox", {
      name: "Новое название чата",
    });
    fireEvent.change(renameInput, { target: { value: "Избранный чат" } });
    fireEvent.keyDown(renameInput, { key: "Enter" });

    await waitFor(() => {
      expect(container.querySelector(".chat-header-title")?.textContent).toBe(
        "Избранный чат",
      );
    });

    fireEvent.click(container.querySelector(".chat-header-menu-button")!);
    fireEvent.click(screen.getByRole("menuitem", { name: "Удалить" }));
    expect(screen.getByRole("alertdialog")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Удалить" }));

    await waitFor(() => {
      const saved = JSON.parse(
        window.localStorage.getItem("hermes-chat") ?? "{}",
      );
      expect(saved.chats).toEqual([]);
    });
  });

  it("links storage errors directly to the data manager", async () => {
    render(<ChatShell />);
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementationOnce(() => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      });

    fireEvent.change(screen.getByRole("textbox", { name: "Сообщение" }), {
      target: { value: "Сообщение без места" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Отправить" }));

    const storageLink = await screen.findByRole("link", {
      name: "Освободить место",
    });
    expect(storageLink.getAttribute("href")).toBe("/settings?tab=data");
    expect(screen.queryByText(/localStorage/i)).toBeNull();
    setItem.mockRestore();
  });
});
