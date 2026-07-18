import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import { api } from "../lib/api";

type Props = { locale: LocaleCode; onLocale: () => void };

type PublicUnit = {
  serialNo: number;
  serialCode: string;
  status: string;
  soldAt: string | null;
  company: {
    name: string;
    phone: string | null;
    logoUrl?: string | null;
    brandPrimary?: string | null;
  };
  product: {
    name: string;
    nameBn: string | null;
    sku: string;
    size: number | null;
    unit: string;
    unitLabel: { en: string; bn: string };
    priceBdt: number;
    description: string | null;
    imageUrl: string | null;
  };
  batch: {
    batchCode: string;
    manufacturedAt: string;
    expiresAt: string | null;
    serialStart: number | null;
    serialEnd: number | null;
  };
};

function statusLabel(status: string, t: ReturnType<typeof getMessages>) {
  if (status === "IN_STOCK") return t.public.unitStatusInStock;
  if (status === "SOLD") return t.public.unitStatusSold;
  if (status === "VOID") return t.public.unitStatusVoid;
  return status;
}

export function PublicUnitPage({ locale, onLocale }: Props) {
  const t = getMessages(locale);
  const { companySlug = "", serialCode = "" } = useParams();
  const [unit, setUnit] = useState<PublicUnit | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .publicUnit(companySlug, serialCode)
      .then((res) => setUnit(res.unit))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Not found"),
      );
  }, [companySlug, serialCode]);

  const sizeUnit = unit
    ? unit.product.size == null
      ? locale === "bn"
        ? unit.product.unitLabel.bn
        : unit.product.unitLabel.en
      : `${unit.product.size} ${
          locale === "bn"
            ? unit.product.unitLabel.bn
            : unit.product.unitLabel.en
        }`
    : "";

  return (
    <div className="auth-page tag-public">
      <button type="button" className="lang float" onClick={onLocale}>
        {t.common.language}
      </button>
      <div className="auth-card wide">
        {error ? <p className="error">{error}</p> : null}
        {!unit && !error ? <p className="muted">{t.common.loading}</p> : null}
        {unit ? (
          <>
            {unit.company.logoUrl ? (
              <img
                className="tag-public-logo"
                src={unit.company.logoUrl}
                alt={unit.company.name}
              />
            ) : (
              <p className="eyebrow">{unit.company.name}</p>
            )}
            {unit.product.imageUrl ? (
              <img
                className="tag-public-product"
                src={unit.product.imageUrl}
                alt=""
              />
            ) : null}
            <h1>
              {locale === "bn" && unit.product.nameBn
                ? unit.product.nameBn
                : unit.product.name}
            </h1>
            {locale === "bn" && unit.product.nameBn ? (
              <p className="muted">{unit.product.name}</p>
            ) : unit.product.nameBn ? (
              <p className="muted">{unit.product.nameBn}</p>
            ) : null}
            <p className="muted">SKU {unit.product.sku}</p>
            {sizeUnit ? <p className="muted">{sizeUnit}</p> : null}
            <p className="wallet-amount">৳{unit.product.priceBdt}</p>
            {unit.product.description ? (
              <p>{unit.product.description}</p>
            ) : null}
            <ul className="plain-list">
              <li>
                <span>{t.public.unitCompany}</span>
                <span>{unit.company.name}</span>
              </li>
              <li>
                <span>{t.public.unitBatch}</span>
                <span>{unit.batch.batchCode}</span>
              </li>
              <li>
                <span>{t.public.unitSerial}</span>
                <span>
                  #{unit.serialNo} · {unit.serialCode}
                </span>
              </li>
              <li>
                <span>{t.public.unitStatus}</span>
                <span>{statusLabel(unit.status, t)}</span>
              </li>
              <li>
                <span>MFG</span>
                <span>
                  {new Date(unit.batch.manufacturedAt).toLocaleDateString()}
                </span>
              </li>
              <li>
                <span>EXP</span>
                <span>
                  {unit.batch.expiresAt
                    ? new Date(unit.batch.expiresAt).toLocaleDateString()
                    : "—"}
                </span>
              </li>
            </ul>
            {unit.company.phone ? (
              <p className="muted">{unit.company.phone}</p>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
