import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LogoutConfirmDialog } from "./logout-confirm-dialog";

describe("LogoutConfirmDialog", () => {
  afterEach(cleanup);

  it("asks before signing out and supports cancel and confirm", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<LogoutConfirmDialog onCancel={onCancel} onConfirm={onConfirm} />);

    expect(screen.getByRole("alertdialog", { name: "Выйти из Hermes?" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
    expect(onCancel).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Выйти" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
