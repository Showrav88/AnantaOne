export type ThemeMode = "light" | "dark" | "night";

const THEME_KEY = "anantaone.theme";
const FONT_KEY = "anantaone.fontScale";

const THEMES: ThemeMode[] = ["light", "dark", "night"];

function isTheme(v: string | null): v is ThemeMode {
  return v === "light" || v === "dark" || v === "night";
}

export function getTheme(): ThemeMode {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    return isTheme(raw) ? raw : "light";
  } catch {
    return "light";
  }
}

/** Apply theme and clear any leftover font-scale attrs that broke layouts. */
export function applyDisplayPrefs(theme = getTheme()) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  delete root.dataset.font;
  try {
    localStorage.removeItem(FONT_KEY);
  } catch {
    /* ignore */
  }
}

export function setTheme(theme: ThemeMode) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
  applyDisplayPrefs(theme);
  window.dispatchEvent(new Event("anantaone:theme-change"));
}

export function cycleTheme(): ThemeMode {
  const cur = getTheme();
  const next = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length]!;
  setTheme(next);
  return next;
}
