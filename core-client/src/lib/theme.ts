export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "hermes-theme";
const THEME_CHANGE_EVENT = "hermes-theme-change";
const DEFAULT_THEME: ThemePreference = "system";

export function isThemePreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function getThemeSnapshot(): ThemePreference {
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemePreference(savedTheme) ? savedTheme : DEFAULT_THEME;
}

export function getThemeServerSnapshot(): ThemePreference {
  return DEFAULT_THEME;
}

export function applyTheme(theme: ThemePreference) {
  document.documentElement.dataset.theme = theme;
}

export function saveThemePreference(theme: ThemePreference) {
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

export function subscribeToTheme(onThemeChange: () => void) {
  window.addEventListener("storage", onThemeChange);
  window.addEventListener(THEME_CHANGE_EVENT, onThemeChange);

  return () => {
    window.removeEventListener("storage", onThemeChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
  };
}
