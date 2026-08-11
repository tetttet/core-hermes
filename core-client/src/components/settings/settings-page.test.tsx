import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_MODEL_ID, MODELS } from "@/config/models";
import { SettingsPage } from "./settings-page";

const chatStore = {
  activeChatId: "chat-1",
  draftModelId: DEFAULT_MODEL_ID,
  chats: [
    {
      id: "chat-1",
      title: "Тестовый чат",
      modelId: DEFAULT_MODEL_ID,
      messages: [
        {
          id: "message-1",
          role: "user" as const,
          content: "Привет",
        },
      ],
      createdAt: 1,
      updatedAt: 1,
    },
  ],
};

const attachment = {
  id: "attachment-1",
  name: "photo.png",
  kind: "image" as const,
  mimeType: "image/png",
  dataUrl: "data:image/png;base64,aGVsbG8=",
  size: 5,
};

const chatStoreWithAttachment = {
  ...chatStore,
  chats: [
    {
      ...chatStore.chats[0],
      messages: [{ ...chatStore.chats[0].messages[0], attachments: [attachment] }],
    },
  ],
};

describe("SettingsPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("saves and immediately applies the selected theme", async () => {
    render(<SettingsPage version="0.1.0" />);

    fireEvent.click(screen.getByRole("button", { name: /Тёмная/ }));

    await waitFor(() => {
      expect(window.localStorage.getItem("hermes-theme")).toBe("dark");
      expect(document.documentElement.dataset.theme).toBe("dark");
    });
  });

  it("changes the default model and describes every available model", async () => {
    window.localStorage.setItem("hermes-chat", JSON.stringify(chatStore));
    render(<SettingsPage version="0.1.0" />);

    fireEvent.click(screen.getByRole("button", { name: "Модели" }));
    const select = screen.getByLabelText("Модель нового чата");
    fireEvent.change(select, { target: { value: MODELS[0].id } });

    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem("hermes-chat") ?? "{}");
      expect(saved.draftModelId).toBe(MODELS[0].id);
    });
    for (const model of MODELS) {
      expect(screen.getByText(model.description)).toBeDefined();
    }
  });

  it("deletes local files without deleting chats and displays the version", async () => {
    window.localStorage.setItem("hermes-chat", JSON.stringify(chatStoreWithAttachment));
    render(<SettingsPage version="0.1.0" />);

    fireEvent.click(screen.getByRole("button", { name: "Данные" }));
    fireEvent.click(screen.getByRole("button", { name: "Удалить все файлы" }));
    expect(screen.getByText("Текстовые чаты останутся.")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Удалить всё" }));

    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem("hermes-chat") ?? "{}");
      expect(saved.chats).toHaveLength(1);
      expect(saved.chats[0].messages[0].content).toBe("Привет");
      expect(saved.chats[0].messages[0].attachments).toBeUndefined();
      expect(screen.getByText("Все файлы удалены с устройства")).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: "О приложении" }));
    expect(screen.getByText("v0.1.0")).toBeDefined();
    expect(
      document.querySelector('.about-logo-image[src="/yahya.svg"]'),
    ).not.toBeNull();
  });

  it("shows local files and deletes one without deleting its chat", async () => {
    const secondChat = {
      ...chatStore.chats[0],
      id: "chat-2",
      title: "Большой чат с вложением",
      messages: [
        ...chatStore.chats[0].messages,
        {
          id: "message-2",
          role: "user" as const,
          content: "Фото",
          attachments: [attachment],
        },
      ],
    };
    window.localStorage.setItem(
      "hermes-chat",
      JSON.stringify({ ...chatStore, chats: [...chatStore.chats, secondChat] }),
    );

    render(<SettingsPage version="0.1.0" initialTab="data" />);

    expect(screen.getByText("Занято файлами")).toBeDefined();
    expect(screen.getByText("photo.png")).toBeDefined();
    expect(screen.getByText(/Большой чат с вложением/)).toBeDefined();
    expect(screen.getByText("Файлов: 1")).toBeDefined();

    fireEvent.click(
      screen.getByRole("button", { name: "Удалить файл «photo.png»" }),
    );
    expect(screen.getByText("Удалить «photo.png» с устройства?")).toBeDefined();
    expect(
      JSON.parse(window.localStorage.getItem("hermes-chat") ?? "{}").chats,
    ).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Удалить файл" }));

    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem("hermes-chat") ?? "{}");
      expect(saved.chats).toHaveLength(2);
      expect(saved.chats[1].messages[1].attachments).toBeUndefined();
      expect(screen.getByText("Файл «photo.png» удалён с устройства")).toBeDefined();
    });
  });
});
