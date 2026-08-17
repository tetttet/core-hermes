import { vi } from "vitest";

vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>();
  const messages = (await import("./messages/ru.json")).default as Record<string, unknown>;
  const translators = new Map<string, (key: string, values?: Record<string, string | number>) => string>();

  return {
    ...actual,
    useLocale: () => "ru",
    useTranslations: (namespace?: string) => {
      const cacheKey = namespace ?? "";
      const cached = translators.get(cacheKey);
      if (cached) return cached;
      const translate = (key: string, values?: Record<string, string | number>) => {
        const path = [...(namespace ? namespace.split(".") : []), ...key.split(".")];
        let message: unknown = messages;
        for (const segment of path) {
          message = (message as Record<string, unknown>)?.[segment];
        }
        if (typeof message !== "string") return key;
        return message.replace(/\{(\w+)\}/g, (match, name: string) =>
          values?.[name] === undefined ? match : String(values[name]),
        );
      };
      translators.set(cacheKey, translate);
      return translate;
    },
  };
});

vi.mock("@/i18n/navigation", async () => {
  const React = await import("react");
  return {
    Link: ({ href, locale, ...props }: Record<string, unknown>) => {
      void locale;
      return React.createElement("a", { ...props, href: String(href) });
    },
    usePathname: () => "/",
    useRouter: () => ({
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
      push: vi.fn(),
      refresh: vi.fn(),
      replace: vi.fn(),
    }),
  };
});
