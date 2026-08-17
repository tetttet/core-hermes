import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HelpFaq } from "./help-faq";

const items = [
  { question: "First question", answer: "First answer" },
  { question: "Second question", answer: "Second answer" },
];

describe("HelpFaq", () => {
  it("opens one answer at a time and closes the active answer", () => {
    render(<HelpFaq items={items} />);

    const first = screen.getByRole("button", { name: "First question" });
    const second = screen.getByRole("button", { name: "Second question" });

    expect(first.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(first);
    expect(first.getAttribute("aria-expanded")).toBe("true");
    expect(
      screen.getByText("First answer").closest("[role=region]")?.getAttribute("aria-hidden"),
    ).toBe("false");

    fireEvent.click(second);
    expect(first.getAttribute("aria-expanded")).toBe("false");
    expect(second.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(second);
    expect(second.getAttribute("aria-expanded")).toBe("false");
  });
});
