"use client";

import { useEffect, useState } from "react";

export type Theme = "dark" | "light";

const KEY = "orbito-theme";

export function getTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Storage can be unavailable in private contexts; the app still works.
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const current = getTheme();
    const timer = setTimeout(() => setTheme(current), 0);
    return () => clearTimeout(timer);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  return { theme, setTheme: (next: Theme) => { setTheme(next); applyTheme(next); }, toggle };
}
