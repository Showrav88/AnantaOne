import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import { api } from "../lib/api";

type Props = { locale: LocaleCode; onLocale: () => void };

type PublicTag = {
  company: { name: string; phone: string | null; address: string | null };
  product: {
    name: string;
    nameBn: string | null;
    sku: string;
    unit: string;
    priceBdt: number;
    description: string | null;
  };
  batch: {
    batchCode: string;
    manufacturedAt: string;
    expiresAt: string | null;
    qtyRemaining: number;
  };
};

export function PublicTagPage({ locale, onLocale }: Props) {
  const t = getMessages(locale);
  const { companySlug = "", sku = "", batchCode = "" } = useParams();
  const [tag, setTag] = useState<PublicTag | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .publicTag(companySlug, sku, batchCode)
      .then((res) => setTag(res.tag))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Not found"),
      );
  }, [companySlug, sku, batchCode]);

  return (
    <div className="auth-page tag-public">
      <button type="button" className="lang float" onClick={onLocale}>
        {t.common.language}
      </button>
      <div className="auth-card wide">
        {error ? <p className="error">{error}</p> : null}
        {!tag && !error ? <p className="muted">{t.common.loading}</p> : null}
        {tag ? (
          <>
            <p className="eyebrow">{tag.company.name}</p>
            <h1>
              {locale === "bn" && tag.product.nameBn
                ? tag.product.nameBn
                : tag.product.name}
            </h1>
            <p className="muted">SKU {tag.product.sku}</p>
            <p className="wallet-amount">৳{tag.product.priceBdt}</p>
            {tag.product.description ? <p>{tag.product.description}</p> : null}
            <ul className="plain-list">
              <li>
                <span>Batch</span>
                <span>{tag.batch.batchCode}</span>
              </li>
              <li>
                <span>MFG</span>
                <span>
                  {new Date(tag.batch.manufacturedAt).toLocaleDateString()}
                </span>
              </li>
              <li>
                <span>EXP</span>
                <span>
                  {tag.batch.expiresAt
                    ? new Date(tag.batch.expiresAt).toLocaleDateString()
                    : "—"}
                </span>
              </li>
            </ul>
            {tag.company.phone ? (
              <p className="muted">{tag.company.phone}</p>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
