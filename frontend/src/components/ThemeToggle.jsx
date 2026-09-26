import { useState } from "react";
import { Moon, Sun } from "lucide-react";

const KEY = "wardzero_theme";

export function currentTheme() {
  const theme = document.documentElement.dataset.theme;
  return theme === "dark" ? "dark" : "light";
}

export function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(KEY, theme);
}

export default function ThemeToggle() {
  const [theme, setLocal] = useState(currentTheme);

  function choose(next) {
    setTheme(next);
    setLocal(next);
  }

  return (
    <div className="theme-toggle" role="group" aria-label="Color theme">
      <button type="button" aria-label="Light" className={theme === "light" ? "active" : ""} onClick={() => choose("light")}><Sun size={16} /></button>
      <button type="button" aria-label="Dark" className={theme === "dark" ? "active" : ""} onClick={() => choose("dark")}><Moon size={16} /></button>
    </div>
  );
}
