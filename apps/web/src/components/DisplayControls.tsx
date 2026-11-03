import { useEffect, useState } from "react";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import { cycleTheme, getTheme, type ThemeMode } from "../lib/prefs";

type Props = {
  locale: LocaleCode;
  compact?: boolean;
};

function themeLabel(theme: ThemeMode, t: ReturnType<typeof getMessages>) {
  if (theme === "dark") return t.common.themeDark;
  if (theme === "night") return t.common.themeNight;
  return t.common.themeLight;
}

export function DisplayControls({ locale, compact }: Props) {
  const t = getMessages(locale);
  const [theme, setThemeState] = useState<ThemeMode>(() => getTheme());

  useEffect(() => {
    function sync() {
      setThemeState(getTheme());
    }
    window.addEventListener("anantaone:theme-change", sync);
    return () => window.removeEventListener("anantaone:theme-change", sync);
  }, []);

  return (
    <div className={`display-controls${compact ? " compact" : ""}`}>
      <button
        type="button"
        className="display-btn"
        title={t.common.themeToggle}
        aria-label={`${t.common.themeToggle}: ${themeLabel(theme, t)}`}
        onClick={() => setThemeState(cycleTheme())}
      >
        {themeLabel(theme, t)}
      </button>
    </div>
  );
}
