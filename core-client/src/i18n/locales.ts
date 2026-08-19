export const locales = ["en", "ru", "es", "de", "tr", "it", "kk"] as const;

export type AppLocale = (typeof locales)[number];

export const localeNames: Record<AppLocale, string> = {
  en: "English",
  ru: "Русский",
  es: "Español",
  de: "Deutsch",
  tr: "Türkçe",
  it: "Italiano",
  kk: "Қазақша",
};
