import { useEffect, useState, useTransition, type FormEvent } from "react";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import { api, type CompanyDetails } from "../../lib/api";

type Props = { locale: LocaleCode };

export function OwnerCompanyPage({ locale }: Props) {
  const t = getMessages(locale);
  const [company, setCompany] = useState<CompanyDetails>();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(() => {
      void (async () => {
        try {
          const res = await api.owner.company();
          setCompany(res.company);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed");
        }
      })();
    });
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!company) return;
    setSaved(false);
    setError(null);
    try {
      const res = await api.owner.updateCompany({
        name: company.name,
        phone: company.phone,
        address: company.address,
        tagline: company.tagline,
        description: company.description,
        locale: company.locale as "bn" | "en",
      });
      setCompany(res.company);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  if (!company) {
    return <p className="muted">{error ?? t.common.loading}</p>;
  }

  return (
    <div className="owner-page">
      <header className="owner-header">
        <div>
          <p className="eyebrow">{t.owner.navCompany}</p>
          <h1>{t.owner.companyTitle}</h1>
          <p className="muted">{t.owner.companyHint}</p>
        </div>
      </header>

      <form className="owner-form" onSubmit={onSubmit}>
        <label>
          {t.owner.fieldName}
          <input
            value={company.name}
            onChange={(e) => setCompany({ ...company, name: e.target.value })}
            required
          />
        </label>
        <label>
          {t.owner.fieldPhone}
          <input
            value={company.phone ?? ""}
            onChange={(e) => setCompany({ ...company, phone: e.target.value })}
          />
        </label>
        <label>
          {t.owner.fieldAddress}
          <input
            value={company.address ?? ""}
            onChange={(e) => setCompany({ ...company, address: e.target.value })}
          />
        </label>
        <label>
          {t.owner.fieldTagline}
          <input
            value={company.tagline ?? ""}
            onChange={(e) => setCompany({ ...company, tagline: e.target.value })}
          />
        </label>
        <label className="full">
          {t.owner.fieldDescription}
          <textarea
            rows={4}
            value={company.description ?? ""}
            onChange={(e) =>
              setCompany({ ...company, description: e.target.value })
            }
          />
        </label>
        <div className="form-actions">
          <button className="btn primary" type="submit" disabled={pending}>
            {t.common.save}
          </button>
          {saved ? <span className="ok">{t.owner.saved}</span> : null}
          {error ? <span className="error">{error}</span> : null}
        </div>
      </form>

      <section className="owner-panels single">
        <div>
          <h2>{t.home.branchesLabel}</h2>
          <ul className="plain-list">
            {company.branches.map((b) => (
              <li key={b.id}>
                <span>{b.name}</span>
                <span>{b.address ?? "—"}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
