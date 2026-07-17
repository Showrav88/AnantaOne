export type ThemeMode = "light" | "dark" | "night";
export type FontScale = "sm" | "md" | "lg" | "xl";

const THEME_KEY = "anantaone.theme";
const FONT_KEY = "anantaone.fontScale";

const THEMES: ThemeMode[] = ["light", "dark", "night"];
const FONTS: FontScale[] = ["sm", "md", "lg", "xl"];

function isTheme(v: string | null): v is ThemeMode {
  return v === "light" || v === "dark" || v === "night";
}

function isFont(v: string | null): v is FontScale {
  return v === "sm" || v === "md" || v === "lg" || v === "xl";
}

export function getTheme(): ThemeMode {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    return isTheme(raw) ? raw : "light";
  } catch {
    return "light";
  }
}

export function getFontScale(): FontScale {
  try {
    const raw = localStorage.getItem(FONT_KEY);
    return isFont(raw) ? raw : "md";
  } catch {
    return "md";
  }
}

export function applyDisplayPrefs(theme = getTheme(), font = getFontScale()) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.font = font;
}

export function setTheme(theme: ThemeMode) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
  applyDisplayPrefs(theme, getFontScale());
}

export function cycleTheme(): ThemeMode {
  const cur = getTheme();
  const next = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length]!;
  setTheme(next);
  return next;
}

export function setFontScale(scale: FontScale) {
  try {
    localStorage.setItem(FONT_KEY, scale);
  } catch {
    /* ignore */
  }
  applyDisplayPrefs(getTheme(), scale);
}

export function bumpFont(delta: -1 | 1): FontScale {
  const cur = getFontScale();
  const idx = FONTS.indexOf(cur);
  const next = FONTS[Math.min(FONTS.length - 1, Math.max(0, idx + delta))]!;
  setFontScale(next);
  return next;
}
