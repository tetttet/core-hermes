import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthPage } from "./auth-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

describe("AuthPage", () => {
  afterEach(cleanup);

  it("renders sign-in with the form before the visual", () => {
    const { container } = render(<AuthPage mode="signin" />);
    expect(container.querySelector(".auth-page")?.getAttribute("data-mode")).toBe("signin");
    expect(screen.getByRole("heading", { name: "С возвращением" })).toBeDefined();
    expect(screen.getByLabelText("Email")).toBeDefined();
    expect(screen.getByRole("link", { name: "Создать аккаунт" })).toBeDefined();
  });

  it("advances through the stepped sign-up form", () => {
    render(<AuthPage mode="signup" />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Пароль"), {
      target: { value: "very-secure-password" },
    });
    fireEvent.change(screen.getByLabelText("Повторите пароль"), {
      target: { value: "very-secure-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Продолжить" }));

    expect(screen.getByRole("heading", { name: "Расскажите о себе" })).toBeDefined();
    expect(screen.getByLabelText("Имя")).toBeDefined();
    expect(screen.getByRole("button", { name: "Назад" })).toBeDefined();
  });
});
