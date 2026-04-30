"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { getStorage, setStorage } from "@/lib/storage/keys";

type Theme = "system" | "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function resolveTheme(theme: Theme): "dark" | "light" {
  if (theme !== "system") return theme;
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(resolved: "dark" | "light") {
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const storage = getStorage();
    return storage?.defaults.theme ?? "system";
  });

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(resolveTheme(next));

    const storage = getStorage();
    if (storage) {
      setStorage({
        ...storage,
        defaults: { ...storage.defaults, theme: next },
      });
    }
  }, []);

  useEffect(() => {
    applyTheme(resolveTheme(theme));
  }, [theme]);

  useEffect(() => {
    if (theme !== "system") return;
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme(resolveTheme("system"));
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  return (
    <ThemeContext value={{ theme, setTheme }}>
      {children}
    </ThemeContext>
  );
}
