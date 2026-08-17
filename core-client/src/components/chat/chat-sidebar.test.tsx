import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MODEL_ID } from "@/config/models";
import type { ChatThread } from "@/types/chat";
import { ChatSidebar } from "./chat-sidebar";

const chats: ChatThread[] = [
  {
    id: "chat-1",
    title: "Очень важный разговор",
    modelId: DEFAULT_MODEL_ID,
    messages: [],
    createdAt: 1,
    updatedAt: 1,
  },
];

function renderSidebar(isCollapsed = false) {
  return render(
    <ChatSidebar
      chats={chats}
      activeChatId="chat-1"
      isOpen
      isBusy={false}
      isCollapsed={isCollapsed}
      onClose={vi.fn()}
      onNewChat={vi.fn()}
      onSelectChat={vi.fn()}
      onDeleteChat={vi.fn()}
      onRenameChat={vi.fn()}
      onToggleFavoriteChat={vi.fn()}
      onToggleCollapse={vi.fn()}
    />,
  );
}

describe("ChatSidebar", () => {
  afterEach(cleanup);

  it("opens the about page from the sidebar", () => {
    renderSidebar();

    expect(
      screen.getByRole("link", { name: "О нас" }).getAttribute("href"),
    ).toBe("/about");
  });

  it("uses the transparent theme-aware logo", () => {
    const { container } = renderSidebar();

    expect(container.querySelector('.sidebar-logo[src="/yahya.svg"]')).not.toBeNull();
  });

  it("shows lightweight chat skeletons while the first page loads", () => {
    render(
      <ChatSidebar
        chats={[]}
        activeChatId={null}
        isOpen
        isBusy={false}
        isLoadingChats
        isCollapsed={false}
        onClose={vi.fn()}
        onNewChat={vi.fn()}
        onSelectChat={vi.fn()}
        onDeleteChat={vi.fn()}
        onRenameChat={vi.fn()}
        onToggleFavoriteChat={vi.fn()}
        onToggleCollapse={vi.fn()}
      />,
    );

    expect(screen.getByRole("status", { name: "Загрузка чатов" })).toBeDefined();
    expect(screen.queryByText("Здесь появятся ваши диалоги")).toBeNull();
  });

  it("requests the next page only after the user asks for it", () => {
    const onLoadMoreChats = vi.fn();
    render(
      <ChatSidebar
        chats={chats}
        activeChatId="chat-1"
        isOpen
        isBusy={false}
        hasMoreChats
        isCollapsed={false}
        onClose={vi.fn()}
        onNewChat={vi.fn()}
        onSelectChat={vi.fn()}
        onDeleteChat={vi.fn()}
        onRenameChat={vi.fn()}
        onToggleFavoriteChat={vi.fn()}
        onLoadMoreChats={onLoadMoreChats}
        onToggleCollapse={vi.fn()}
      />,
    );

    expect(onLoadMoreChats).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
    expect(onLoadMoreChats).toHaveBeenCalledOnce();
  });

  it("shows the chat title tooltip only in collapsed mode", () => {
    const { rerender } = renderSidebar();
    const chatButton = screen.getByRole("button", { name: "Очень важный разговор" });

    fireEvent.mouseEnter(chatButton.closest(".tooltip-anchor")!);
    expect(screen.queryByRole("tooltip")).toBeNull();

    rerender(
      <ChatSidebar
        chats={chats}
        activeChatId="chat-1"
        isOpen
        isBusy={false}
        isCollapsed
        onClose={vi.fn()}
        onNewChat={vi.fn()}
        onSelectChat={vi.fn()}
        onDeleteChat={vi.fn()}
        onRenameChat={vi.fn()}
        onToggleFavoriteChat={vi.fn()}
        onToggleCollapse={vi.fn()}
      />,
    );

    const collapsedChatButton = screen.getByRole("button", {
      name: "Очень важный разговор",
    });
    fireEvent.mouseEnter(collapsedChatButton.closest(".tooltip-anchor")!);
    expect(screen.getByRole("tooltip").textContent).toBe("Очень важный разговор");
  });

  it("keeps the three-dot menu stable until the trigger or an outside area is pressed", () => {
    const { container } = renderSidebar();
    const actionsButton = screen.getByRole("button", {
      name: "Действия с чатом «Очень важный разговор»",
    });

    fireEvent.click(actionsButton);
    expect(screen.getByRole("menu")).toBeDefined();

    fireEvent.mouseLeave(container.querySelector(".sidebar-chat")!);
    expect(screen.getByRole("menu")).toBeDefined();

    fireEvent.pointerDown(actionsButton);
    fireEvent.click(actionsButton);
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(actionsButton);
    expect(screen.getByRole("menu")).toBeDefined();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("moves favorite chats above newer regular chats", () => {
    const favoriteChat: ChatThread = {
      ...chats[0],
      id: "chat-favorite",
      title: "Избранный разговор",
      isFavorite: true,
      updatedAt: 1,
    };
    const recentChat: ChatThread = {
      ...chats[0],
      id: "chat-recent",
      title: "Недавний разговор",
      updatedAt: 10,
    };

    const { container } = render(
      <ChatSidebar
        chats={[recentChat, favoriteChat]}
        activeChatId="chat-recent"
        isOpen
        isBusy={false}
        isCollapsed={false}
        onClose={vi.fn()}
        onNewChat={vi.fn()}
        onSelectChat={vi.fn()}
        onDeleteChat={vi.fn()}
        onRenameChat={vi.fn()}
        onToggleFavoriteChat={vi.fn()}
        onToggleCollapse={vi.fn()}
      />,
    );

    const titles = Array.from(
      container.querySelectorAll(".sidebar-chat-title"),
      (element) => element.textContent,
    );
    expect(titles).toEqual(["Избранный разговор", "Недавний разговор"]);
    expect(screen.getByText("Избранные")).toBeDefined();
    expect(screen.getByText("Недавние")).toBeDefined();
  });

  it("offers a favorite action in the three-dot menu", () => {
    const onToggleFavoriteChat = vi.fn();
    render(
      <ChatSidebar
        chats={chats}
        activeChatId="chat-1"
        isOpen
        isBusy={false}
        isCollapsed={false}
        onClose={vi.fn()}
        onNewChat={vi.fn()}
        onSelectChat={vi.fn()}
        onDeleteChat={vi.fn()}
        onRenameChat={vi.fn()}
        onToggleFavoriteChat={onToggleFavoriteChat}
        onToggleCollapse={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Действия с чатом «Очень важный разговор»",
      }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "В избранное" }));

    expect(onToggleFavoriteChat).toHaveBeenCalledWith("chat-1");
  });

  it("opens profile, settings, language, and help items from the user block", () => {
    renderSidebar();

    expect(screen.queryByRole("menuitem", { name: "Настройки" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Настройки" })).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Открыть меню пользователя" }),
    );

    const menu = screen.getByRole("menu");
    expect(menu.getAttribute("data-open")).toBe("true");
    expect(screen.getByRole("menuitem", { name: "Профиль" }).getAttribute("href")).toBe(
      "/profile",
    );
    expect(screen.getByRole("menuitem", { name: "Настройки" }).getAttribute("href")).toBe(
      "/settings",
    );
    expect(
      screen.getByRole("menuitem", { name: "Получить помощь" }).getAttribute("href"),
    ).toBe("/help");
    expect(screen.getByRole("menuitem", { name: "Язык" })).toBeDefined();

    fireEvent.focus(screen.getByRole("menuitem", { name: "Язык" }));
    expect(screen.getByRole("menu", { name: "Доступные языки" })).toBeDefined();
    expect(screen.getByRole("menuitem", { name: "English" })).toBeDefined();
    expect(screen.getByRole("menuitem", { name: "Русский" })).toBeDefined();
  });

  it("switches language from the current route and closes the mobile sidebar", () => {
    const onClose = vi.fn();
    render(
      <ChatSidebar
        chats={chats}
        activeChatId="chat-1"
        isOpen
        isBusy={false}
        isCollapsed={false}
        onClose={onClose}
        onNewChat={vi.fn()}
        onSelectChat={vi.fn()}
        onDeleteChat={vi.fn()}
        onRenameChat={vi.fn()}
        onToggleFavoriteChat={vi.fn()}
        onToggleCollapse={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Открыть меню пользователя" }));
    fireEvent.focus(screen.getByRole("menuitem", { name: "Язык" }));
    expect(screen.getByRole("menuitem", { name: "Русский" }).getAttribute("aria-current"))
      .toBe("true");
    fireEvent.click(screen.getByRole("menuitem", { name: "English" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes the user menu with Escape or an outside press", () => {
    renderSidebar();

    fireEvent.click(
      screen.getByRole("button", { name: "Открыть меню пользователя" }),
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Открыть меню пользователя" }),
    );
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
