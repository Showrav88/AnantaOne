import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import { api } from "../lib/api";
import { homePathForRole } from "../lib/session";

type Props = { locale: LocaleCode; onLocale: () => void };

export function LoginPage({ locale, onLocale }: Props) {
  const t = getMessages(locale);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await api.auth.login({ email, password });
      navigate(homePathForRole(res.user.role.code));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="atmosphere" aria-hidden="true" />
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="auth-top">
          <p className="brand mini">{t.app.name}</p>
          <button type="button" className="lang" onClick={onLocale}>
            {t.common.language}
          </button>
        </div>
        <h1>{t.auth.loginTitle}</h1>
        <p className="muted">{t.auth.loginHint}</p>
        <label>
          {t.auth.email}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label>
          {t.auth.password}
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn primary" type="submit" disabled={pending}>
          {t.auth.loginCta}
        </button>
        <p className="auth-foot">
          {t.auth.noAccount} <Link to="/register">{t.auth.registerCta}</Link>
        </p>
        <p className="auth-foot">
          <Link to="/pulse">{t.owner.navPublic}</Link>
        </p>
      </form>
    </div>
  );
}
