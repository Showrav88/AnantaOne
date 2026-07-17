import { useState } from "react";
import { APP_NAME } from "@anantaone/shared";
import { getMessages, type LocaleCode } from "@anantaone/i18n";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

export function App() {
  const [locale, setLocale] = useState<LocaleCode>("bn");
  const [health, setHealth] = useState<string>("…");
  const messages = getMessages(locale);

  async function checkApi() {
    try {
      const res = await fetch(`${apiUrl}/health`);
      const data = (await res.json()) as { ok?: boolean; app?: string };
      setHealth(data.ok ? `${data.app ?? APP_NAME} API OK` : "API error");
    } catch {
      setHealth("API offline");
    }
  }

  return (
    <div className="shell">
      <header className="hero">
        <p className="brand">{messages.app.name}</p>
        <h1>{messages.app.tagline}</h1>
        <p className="lede">
          {locale === "bn"
            ? "ক্লাউডে Neon বা লোকালে Docker — একই Prisma মাইগ্রেশন।"
            : "Neon in the cloud or Docker locally — same Prisma migrations."}
        </p>
        <div className="actions">
          <button type="button" onClick={() => setLocale(locale === "bn" ? "en" : "bn")}>
            {locale === "bn" ? "English" : "বাংলা"}
          </button>
          <button type="button" className="primary" onClick={checkApi}>
            {messages.common.save === "Save" ? "Check API" : "API পরীক্ষা"}
          </button>
        </div>
        <p className="status" aria-live="polite">
          {health}
        </p>
      </header>
    </div>
  );
}
