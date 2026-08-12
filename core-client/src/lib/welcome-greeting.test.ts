import { describe, expect, it } from "vitest";
import { getWelcomeGreeting } from "./welcome-greeting";

describe("getWelcomeGreeting", () => {
  it("uses the current part of day", () => {
    expect(
      getWelcomeGreeting(new Date("2026-08-11T06:00:00")),
    ).toMatch(/утро|Утро/u);
    expect(
      getWelcomeGreeting(new Date("2026-08-11T19:00:00")),
    ).toMatch(/вечер|день/u);
  });

  it("occasionally uses the profile name while rotating phrases", () => {
    const user = { firstName: "Яхъя", lastName: "Туран" };
    const greetings = Array.from({ length: 8 }, (_, index) =>
      getWelcomeGreeting(new Date(2026, 7, 11, 12, index * 15), user),
    );

    expect(greetings.some((greeting) => greeting.includes("Яхъя"))).toBe(true);
    expect(greetings.some((greeting) => greeting.includes("Яхъя Туран"))).toBe(true);
    expect(new Set(greetings).size).toBeGreaterThan(1);
  });

  it("keeps greetings compact", () => {
    const user = { firstName: "Яхъя", lastName: "Туран" };
    const hours = [6, 12, 18, 23];
    const greetings = hours.flatMap((hour) =>
      Array.from({ length: 4 }, (_, index) =>
        getWelcomeGreeting(new Date(2026, 7, 11, hour, index * 15), user),
      ),
    );

    expect(Math.max(...greetings.map((greeting) => greeting.length))).toBeLessThanOrEqual(32);
  });
});
