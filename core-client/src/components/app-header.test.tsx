import { act, cleanup, fireEvent, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppHeader } from "./app-header";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    ViewTransition: ({ children }: { children: ReactNode }) => children,
  };
});

describe("AppHeader", () => {
  let nextFrame: FrameRequestCallback | undefined;

  beforeEach(() => {
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 0,
    });
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      nextFrame = callback;
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("smoothly switches to the compact sticky state after scrolling", () => {
    const { container } = render(<AppHeader activePage="about" />);
    const header = container.querySelector(".generation-header")!;

    expect(header.getAttribute("data-compact")).toBe("false");

    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 64,
    });
    fireEvent.scroll(window);
    act(() => nextFrame?.(0));
    expect(header.getAttribute("data-compact")).toBe("true");

    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 0,
    });
    fireEvent.scroll(window);
    act(() => nextFrame?.(0));
    expect(header.getAttribute("data-compact")).toBe("false");
  });

  it("reacts to an internal page scroll", () => {
    const { container } = render(<AppHeader activePage="about" />);
    const header = container.querySelector(".generation-header")!;
    const scroller = document.createElement("div");
    Object.defineProperty(scroller, "scrollTop", {
      configurable: true,
      value: 72,
    });
    document.body.append(scroller);

    fireEvent.scroll(scroller);
    act(() => nextFrame?.(0));

    expect(header.getAttribute("data-compact")).toBe("true");
    scroller.remove();
  });
});
