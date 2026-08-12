import { describe, expect, it } from "vitest";
import { createChatTitle } from "./chat-title";

describe("createChatTitle", () => {
  it("removes conversational filler and keeps the actual task", () => {
    expect(
      createChatTitle(
        "Привет! Можешь ли ты помочь мне составить план запуска продукта? Потом добавь сроки.",
        [],
      ),
    ).toBe("Составить план запуска продукта");
  });

  it("creates a readable title without waiting for another API call", () => {
    expect(
      createChatTitle(
        "Мне нужно, чтобы ты проанализировал квартальный отчёт и нашёл точки роста для отдела продаж",
        [],
      ),
    ).toBe("Проанализировал квартальный отчёт и нашёл точки…");
  });

  it("uses attachment context when the prompt is empty", () => {
    expect(
      createChatTitle("", [
        {
          id: "file-1",
          name: "campaign-concept.png",
          kind: "image",
          mimeType: "image/png",
          dataUrl: "data:image/png;base64,AA==",
          size: 2,
        },
      ]),
    ).toBe("Разбор campaign-concept.png");
  });
});
