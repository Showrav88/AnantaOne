import { useState } from "react";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import {
  bumpFont,
  cycleTheme,
  getFontScale,
  getTheme,
  type FontScale,
  type ThemeMode,
} from "../lib/prefs";

type Props = {
  locale: LocaleCode;
  compact?: boolean;
};

function themeLabel(theme: ThemeMode, t: ReturnType<typeof getMessages>) {
  if (theme === "dark") return t.common.themeDark;
  if (theme === "night") return t.common.themeNight;
  return t.common.themeLight;
}

function fontLabel(scale: FontScale) {
  if (scale === "sm") return "A−";
  if (scale === "lg") return "A+";
  if (scale === "xl") return "A++";
  return "A";
}

export function DisplayControls({ locale, compact }: Props) {
  const t = getMessages(locale);
  const [theme, setThemeState] = useState<ThemeMode>(() => getTheme());
  const [font, setFontState] = useState<FontScale>(() => getFontScale());

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
      <div className="font-size-group" role="group" aria-label={t.common.fontSize}>
        <button
          type="button"
          className="display-btn"
          title={t.common.fontSmaller}
          aria-label={t.common.fontSmaller}
          disabled={font === "sm"}
          onClick={() => setFontState(bumpFont(-1))}
        >
          A−
        </button>
        <span className="font-size-label" aria-hidden>
          {fontLabel(font)}
        </span>
        <button
          type="button"
          className="display-btn"
          title={t.common.fontLarger}
          aria-label={t.common.fontLarger}
          disabled={font === "xl"}
          onClick={() => setFontState(bumpFont(1))}
        >
          A+
        </button>
      </div>
    </div>
  );
}
