import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import { SalesInvoiceView } from "../components/SalesInvoiceView";
import { api, type SalesInvoice } from "../lib/api";
import { getAccessToken } from "../lib/session";

type Props = { locale: LocaleCode; onLocale: () => void };

export function PublicInvoicePage({ locale, onLocale }: Props) {
  const t = getMessages(locale);
  const { companySlug = "", invoiceCode = "" } = useParams();
  const [invoice, setInvoice] = useState<SalesInvoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loggedIn = Boolean(getAccessToken());

  useEffect(() => {
    void (async () => {
      try {
        if (loggedIn) {
          const inv = await api.owner.lookupInvoice(
            decodeURIComponent(invoiceCode),
          );
          setInvoice(inv.invoice);
        } else {
          const inv = await api.publicInvoice(
            companySlug,
            decodeURIComponent(invoiceCode),
          );
          setInvoice(inv.invoice);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Not found");
      }
    })();
  }, [companySlug, invoiceCode, loggedIn]);

  return (
    <div className="owner-page invoice-public">
      <header className="owner-header no-print">
        <div>
          <p className="eyebrow">{t.owner.invoiceLabel}</p>
          <h1>{decodeURIComponent(invoiceCode)}</h1>
        </div>
        <div className="header-links">
          <button type="button" className="lang" onClick={onLocale}>
            {t.common.language}
          </button>
          {loggedIn ? (
            <Link to={`/owner/history?order=${invoice?.id ?? ""}`}>
              {t.owner.openHistory}
            </Link>
          ) : (
            <Link to="/login">{t.auth.loginCta}</Link>
          )}
        </div>
      </header>
      {error ? <p className="error-banner">{error}</p> : null}
      {!invoice && !error ? <p className="muted">{t.common.loading}</p> : null}
      {invoice ? <SalesInvoiceView locale={locale} invoice={invoice} /> : null}
    </div>
  );
}
