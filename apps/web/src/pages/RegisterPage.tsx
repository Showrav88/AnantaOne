import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import { api } from "../lib/api";

type Props = { locale: LocaleCode; onLocale: () => void };

export function RegisterPage({ locale, onLocale }: Props) {
  const t = getMessages(locale);
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api.auth.register({
        companyName,
        ownerName,
        email,
        phone: phone || undefined,
        password,
        locale,
      });
      navigate("/owner");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Register failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="atmosphere" aria-hidden="true" />
      <form className="auth-card wide" onSubmit={onSubmit}>
        <div className="auth-top">
          <p className="brand mini">{t.app.name}</p>
          <button type="button" className="lang" onClick={onLocale}>
            {t.common.language}
          </button>
        </div>
        <h1>{t.auth.registerTitle}</h1>
        <p className="muted">{t.auth.registerHint}</p>
        <label>
          {t.auth.companyName}
          <input
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
        </label>
        <label>
          {t.auth.ownerName}
          <input
            required
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
          />
        </label>
        <label>
          {t.auth.email}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          {t.auth.phone}
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label>
          {t.auth.password}
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn primary" type="submit" disabled={pending}>
          {t.auth.registerCta}
        </button>
        <p className="auth-foot">
          {t.auth.hasAccount} <Link to="/login">{t.auth.loginCta}</Link>
        </p>
      </form>
    </div>
  );
}
