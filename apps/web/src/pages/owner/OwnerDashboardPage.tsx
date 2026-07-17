import { useEffect, useState, useTransition } from "react";
import { Link } from "react-router-dom";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import { api, type OwnerDashboard } from "../../lib/api";

type Props = { locale: LocaleCode };

export function OwnerDashboardPage({ locale }: Props) {
  const t = getMessages(locale);
  const [data, setData] = useState<OwnerDashboard>();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(() => {
      void (async () => {
        try {
          const res = await api.owner.dashboard();
          setData(res.dashboard);
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed");
        }
      })();
    });
  }, []);

  if (error) {
    return <p className="error">{error}</p>;
  }

  if (!data || pending) {
    return <p className="muted">{t.common.loading}</p>;
  }

  return (
    <div className="owner-page">
      <header className="owner-header">
        <div>
          <p className="eyebrow">{t.owner.navDashboard}</p>
          <h1>{data.company.name}</h1>
          <p className="muted">{data.company.tagline ?? t.app.pulse}</p>
        </div>
        <Link className="btn primary" to="/owner/products">
          {t.owner.manageProducts}
        </Link>
      </header>

      <section className="stat-grid">
        <article>
          <p>{t.owner.statProducts}</p>
          <strong>{data.stats.products}</strong>
        </article>
        <article>
          <p>{t.owner.statBuyers}</p>
          <strong>{data.stats.buyers}</strong>
        </article>
        <article>
          <p>{t.owner.statLowStock}</p>
          <strong className={data.stats.lowStock > 0 ? "warn" : ""}>
            {data.stats.lowStock}
          </strong>
        </article>
        <article>
          <p>{t.owner.statUsers}</p>
          <strong>{data.stats.users}</strong>
        </article>
      </section>

      <section className="owner-panels">
        <div>
          <h2>{t.owner.lowStockTitle}</h2>
          {data.lowStock.length === 0 ? (
            <p className="muted">{t.owner.lowStockEmpty}</p>
          ) : (
            <ul className="plain-list">
              {data.lowStock.map((p) => (
                <li key={p.id}>
                  <span>{locale === "bn" && p.nameBn ? p.nameBn : p.name}</span>
                  <span>
                    {p.stockQty} / min {p.minStock}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h2>{t.owner.recentProducts}</h2>
          <ul className="plain-list">
            {data.recentProducts.map((p) => (
              <li key={p.id}>
                <span>{locale === "bn" && p.nameBn ? p.nameBn : p.name}</span>
                <span>৳{p.priceBdt}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
