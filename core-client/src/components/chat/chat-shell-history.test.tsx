import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatShell } from "./chat-shell";

const mocks = vi.hoisted(() => ({
  auth: {
    status: "authenticated" as const,
    user: {
      id: "new-user",
      email: "new@example.com",
      firstName: "Новый",
      lastName: "Пользователь",
      age: 25,
      createdAt: "2026-08-11T00:00:00.000Z",
      lastActiveAt: "2026-08-11T00:00:00.000Z",
    },
  },
  loadRemoteChats: vi.fn(),
}));

vi.mock("@/lib/auth-store", () => ({
  getAuthSnapshot: () => mocks.auth,
  getAuthServerSnapshot: () => mocks.auth,
  initializeAuth: vi.fn().mockResolvedValue(undefined),
  subscribeToAuth: () => () => {},
}));

vi.mock("@/lib/core-api", () => ({
  deleteRemoteChat: vi.fn(),
  loadRemoteChats: mocks.loadRemoteChats,
  loadRemoteMessages: vi.fn(),
  streamChat: vi.fn(),
  updateRemoteChat: vi.fn(),
}));

describe("ChatShell remote history", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.loadRemoteChats.mockReset();
    mocks.loadRemoteChats.mockResolvedValue({ items: [], nextCursor: null });
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

  it("finishes the skeleton for a new account under React Strict Mode", async () => {
    render(
      <StrictMode>
        <ChatShell />
      </StrictMode>,
    );

    await waitFor(() => {
      expect(screen.getByText("Здесь появятся ваши диалоги")).toBeDefined();
    });
    expect(screen.queryByRole("status", { name: "Загрузка чатов" })).toBeNull();
    expect(mocks.loadRemoteChats).toHaveBeenCalled();
  });
});
