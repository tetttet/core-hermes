import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarkdownMessage } from "./markdown-message";

describe("MarkdownMessage", () => {
  it("renders CommonMark, GFM, HTML, and math instead of showing markup symbols", () => {
    const { container } = render(
      <MarkdownMessage>{`# Заголовок

**жирный** и ~~зачёркнутый~~

- [x] готово

| A | B |
| - | - |
| 1 | 2 |

<mark>важно</mark>

$x^2$

\`\`\`ts
const ok = true
\`\`\``}</MarkdownMessage>,
    );

    expect(screen.getByRole("heading", { name: "Заголовок" })).toBeDefined();
    expect(screen.getByText("жирный").tagName).toBe("STRONG");
    expect(screen.getByText("зачёркнутый").tagName).toBe("DEL");
    expect(screen.getByRole("checkbox")).toHaveProperty("checked", true);
    expect(screen.getByRole("table")).toBeDefined();
    expect(screen.getByText("важно").tagName).toBe("MARK");
    expect(container.querySelector(".katex")).not.toBeNull();
    expect(container.querySelector("code.language-ts")).not.toBeNull();
    expect(container.querySelector(".hljs-keyword")?.textContent).toBe("const");
    expect(screen.getByText("TypeScript")).toBeDefined();
  });

  it("normalizes common LaTeX delimiters without changing code", () => {
    const markdown = [
      String.raw`Inline \(x + y\).`,
      "",
      String.raw`\[`,
      "x^2 + y^2 = z^2",
      String.raw`\]`,
      "",
      "Keep `\\(code\\)` and:",
      "",
      "```text",
      String.raw`\[not math\]`,
      "```",
    ].join("\n");

    const { container } = render(
      <MarkdownMessage>{markdown}</MarkdownMessage>,
    );

    expect(container.querySelectorAll(".katex")).toHaveLength(2);
    expect(container.querySelectorAll(".katex-display")).toHaveLength(1);
    expect(screen.getByText(String.raw`\(code\)`)).toBeDefined();
    expect(screen.getByText(String.raw`\[not math\]`)).toBeDefined();
  });

  it("copies a code block and confirms the action", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <MarkdownMessage>
        {["```js", "const answer = 42;", "```"].join("\n")}
      </MarkdownMessage>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Копировать: JavaScript" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("const answer = 42;"));
    expect(screen.getByText("Скопировано")).toBeDefined();
  });

  it("sanitizes executable HTML while preserving safe formatting", () => {
    const { container } = render(
      <MarkdownMessage>{`<script>window.__unsafe = true</script>
<img src="x" alt="пример" onerror="window.__unsafe = true">
<details open><summary>Подробнее</summary><b>Безопасно</b></details>`}</MarkdownMessage>,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByAltText("пример").getAttribute("onerror")).toBeNull();
    expect(screen.getByText("Подробнее").tagName).toBe("SUMMARY");
    expect(screen.getByText("Безопасно").tagName).toBe("B");
  });

  it("opens external links safely", () => {
    render(<MarkdownMessage>{"[OpenRouter](https://openrouter.ai)"}</MarkdownMessage>);
    const link = screen.getByRole("link", { name: "OpenRouter" });

    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });
});
