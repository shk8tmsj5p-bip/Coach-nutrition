"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { storage } from "@/lib/storage";

export type ColorScheme = "light" | "dark";

const LIGHT_THEME = "#F2F4F8";
const DARK_THEME = "#000000";

function preferDark() {
  if (typeof window === "undefined") return false;
  const saved = storage.get("theme");
  if (saved === "dark") return true;
  if (saved === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyScheme(scheme: ColorScheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", scheme === "dark");
  root.style.colorScheme = scheme;
  const theme = scheme === "dark" ? DARK_THEME : LIGHT_THEME;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme);
}

interface ThemeContextValue {
  scheme: ColorScheme;
  isDark: boolean;
  toggleScheme: () => void;
  setScheme: (scheme: ColorScheme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [scheme, setScheme] = useState<ColorScheme>("light");

  useEffect(() => {
    const next = preferDark() ? "dark" : "light";
    setScheme(next);
    applyScheme(next);
  }, []);

  const toggleScheme = useCallback(() => {
    setScheme((current) => {
      const next: ColorScheme = current === "dark" ? "light" : "dark";
      storage.set("theme", next);
      applyScheme(next);
      return next;
    });
  }, []);

  const chooseScheme = useCallback((next: ColorScheme) => {
    storage.set("theme", next);
    applyScheme(next);
    setScheme(next);
  }, []);

  const value = useMemo(
    () => ({ scheme, isDark: scheme === "dark", toggleScheme, setScheme: chooseScheme }),
    [scheme, toggleScheme, chooseScheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
