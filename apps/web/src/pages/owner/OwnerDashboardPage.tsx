import { useEffect, useState, useTransition } from "react";
import { Link } from "react-router-dom";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import { api, type OwnerDashboard } from "../../lib/api";
import { getStoredUser } from "../../lib/session";

type Props = { locale: LocaleCode };

export function OwnerDashboardPage({ locale }: Props) {
  const t = getMessages(locale);
  const user = getStoredUser();
  const isOwner = user?.role.code === "OWNER";
  const [data, setData] = useState<OwnerDashboard>();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    function load() {
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
    }
    load();
    window.addEventListener("anantaone:branch-change", load);
    return () => window.removeEventListener("anantaone:branch-change", load);
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
        <div className="header-links">
          {isOwner ? (
            <>
              <Link className="btn primary" to="/owner/buyers">
                {t.owner.manageBuyers}
              </Link>
              <Link className="btn ghost" to="/owner/branches">
                {t.owner.manageBranches}
              </Link>
              <Link className="btn ghost" to="/owner/site">
                {t.owner.navSite}
              </Link>
              <Link className="btn ghost" to="/owner/wallet">
                {t.owner.navWallet}
              </Link>
            </>
          ) : (
            <Link className="btn primary" to="/owner/sell">
              {t.owner.navSell}
            </Link>
          )}
        </div>
      </header>

      {isOwner ? (
        <section className="panel-card upload-panel">
          <h2>{t.owner.siteTitle}</h2>
          <p className="muted">{t.owner.siteHint}</p>
          <div className="site-upload-row">
            <Link className="btn primary" to="/owner/site">
              {t.owner.uploadSectionTitle}
            </Link>
            <Link className="btn ghost" to="/owner/products">
              {t.owner.uploadProductImage}
            </Link>
            <Link className="btn ghost" to="/owner/buyers">
              {t.owner.manageBuyers}
            </Link>
            {data.company.slug ? (
              <Link className="btn ghost" to={`/shop/${data.company.slug}`}>
                {t.owner.openPublicShop}
              </Link>
            ) : null}
            <Link className="btn ghost" to="/pulse">
              {t.owner.navPublic}
            </Link>
          </div>
        </section>
      ) : (
        <section className="panel-card upload-panel">
          <h2>{t.owner.branchWorkspaceTitle}</h2>
          <p className="muted">{t.owner.branchWorkspaceHint}</p>
        </section>
      )}

      <section className="stat-grid">
        {isOwner && data.stats.cashBalanceBdt != null ? (
          <article>
            <p>{t.owner.statCash}</p>
            <strong>
              ৳{data.stats.cashBalanceBdt.toLocaleString()}
            </strong>
          </article>
        ) : null}
        <article>
          <p>{t.owner.statProducts}</p>
          <strong>{data.stats.products}</strong>
        </article>
        {isOwner && data.stats.buyers != null ? (
          <article>
            <Link to="/owner/buyers" className="stat-link">
              <p>{t.owner.statBuyers}</p>
              <strong>{data.stats.buyers}</strong>
            </Link>
          </article>
        ) : null}
        {isOwner && data.stats.lowStock != null ? (
          <article>
            <p>{t.owner.statLowStock}</p>
            <strong className={data.stats.lowStock > 0 ? "warn" : ""}>
              {data.stats.lowStock}
            </strong>
          </article>
        ) : null}
        <article>
          <p>{t.owner.statUsers}</p>
          <strong>{data.stats.users}</strong>
        </article>
        {data.stats.branchOrders != null ? (
          <article>
            <p>{t.owner.statBranchOrders}</p>
            <strong>{data.stats.branchOrders}</strong>
          </article>
        ) : null}
      </section>

      {isOwner ? (
        <section className="owner-panels">
          <div>
            <h2>{t.owner.lowStockTitle}</h2>
            {data.lowStock.length === 0 ? (
              <p className="muted">{t.owner.lowStockEmpty}</p>
            ) : (
              <ul className="plain-list">
                {data.lowStock.map((p) => (
                  <li key={p.id}>
                    <span>
                      {locale === "bn" && p.nameBn ? p.nameBn : p.name}
                    </span>
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
                  <span>
                    {locale === "bn" && p.nameBn ? p.nameBn : p.name}
                  </span>
                  <span>৳{p.priceBdt}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </div>
  );
}
