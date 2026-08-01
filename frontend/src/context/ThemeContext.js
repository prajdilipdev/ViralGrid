import { createContext, useCallback, useContext, useEffect, useState } from "react";

/**
 * Light/dark as a manual choice, not an OS-level assumption.
 *
 * The theme is a `.light` class on <html>, so it can be toggled at runtime and
 * every token in index.css re-resolves. The OS preference is only used as the
 * initial guess when the user hasn't chosen before.
 */
const ThemeContext = createContext(null);
const STORAGE_KEY = "viralgrid_theme";

const readInitial = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* storage blocked (private mode) — fall through to the OS hint */
  }
  const prefersLight =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: light)").matches;
  return prefersLight ? "light" : "dark";
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(readInitial);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", theme === "light");
    // shadcn primitives key off `.dark`, so keep the two in step.
    root.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* not fatal — the theme just won't persist across reloads */
    }
  }, [theme]);

  const toggle = useCallback(
    () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    [],
  );

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
