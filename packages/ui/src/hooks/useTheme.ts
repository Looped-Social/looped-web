import { useEffect, useState } from "react";

export type Theme = "light" | "dark";
export type ThemePreference = "system" | Theme;

const STORAGE_KEY = "looped-theme";
const THEME_EVENT = "looped-theme-change";

type ThemeChangeEvent = CustomEvent<ThemePreference>;

function getPreferredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || isTheme(value);
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    if (typeof window === "undefined") return "system";
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isThemePreference(stored)) return stored;
    return "system";
  });
  const [systemTheme, setSystemTheme] = useState<Theme>(() => getPreferredTheme());
  const theme: Theme = preference === "system" ? systemTheme : preference;

  // Apply resolved theme to root element.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;

    if (theme === "dark") {
      root.setAttribute("data-theme", "dark");
    } else {
      root.removeAttribute("data-theme");
    }
  }, [theme]);

  // Persist preference and broadcast changes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (preference === "system") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, preference);
    }
    window.dispatchEvent(new CustomEvent<ThemePreference>(THEME_EVENT, { detail: preference }));
  }, [preference]);

  // Keep system theme in sync with OS preference.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const customEvent = event as ThemeChangeEvent;
      const nextPreference = customEvent.detail;
      if (!isThemePreference(nextPreference)) return;
      if (nextPreference === preference) return;
      setPreference(nextPreference);
    };

    window.addEventListener(THEME_EVENT, handler);
    return () => window.removeEventListener(THEME_EVENT, handler);
  }, [preference]);

  const toggleTheme = () => {
    setPreference((previous) => {
      const previousResolved = previous === "system" ? systemTheme : previous;
      return previousResolved === "light" ? "dark" : "light";
    });
  };

  const setThemePreference = (next: ThemePreference) => {
    setPreference(next);
  };

  return { theme, preference, setThemePreference, toggleTheme };
}
