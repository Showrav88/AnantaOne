import { useEffect, useState, useTransition } from "react";
import { Link } from "react-router-dom";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import { api, type BuyersResponse, type OverviewResponse, type Product } from "../lib/api";

type LinkState = "loading" | "up" | "down";

type Props = {
  locale: LocaleCode;
  onLocale: () => void;
};

export function HomePulsePage({ locale, onLocale }: Props) {
  const [apiState, setApiState] = useState<LinkState>("loading");
  const [dbState, setDbState] = useState<LinkState>("loading");
  const [overview, setOverview] = useState<OverviewResponse["company"]>();
  const [buyers, setBuyers] = useState<BuyersResponse["buyers"]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showLive, setShowLive] = useState(false);
  const [pending, startTransition] = useTransition();
  const t = getMessages(locale);

  async function refresh() {
    setError(null);
    try {
      const health = await api.health();
      setApiState(health.ok ? "up" : "down");
    } catch {
      setApiState("down");
      setDbState("down");
      setOverview(undefined);
      setBuyers([]);
      setProducts([]);
      setError(`${t.home.notConnected} → ${api.baseUrl}`);
      return;
    }

    try {
      const db = await api.healthDb();
      setDbState(db.ok ? "up" : "down");
    } catch {
      setDbState("down");
    }

    try {
      const [ov, by, prod] = await Promise.all([
        api.overview(),
        api.buyers(),
        api.products(),
      ]);
      setOverview(ov.company);
      setBuyers(by.buyers ?? []);
      setProducts((prod.products ?? []).filter((p) => p.isActive).slice(0, 6));
    } catch (err) {
      setError(err instanceof Error ? err.message : "API error");
    }
  }

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 901) {
      setShowLive(true);
    }
    startTransition(() => {
      void refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connected = apiState === "up" && dbState === "up";

  function openLive() {
    setShowLive(true);
    startTransition(() => {
      void refresh();
    });
    if (typeof window !== "undefined" && window.innerWidth < 901) {
      requestAnimationFrame(() => {
        document.getElementById("live")?.scrollIntoView({ behavior: "smooth" });
      });
    }
  }

  return (
    <div className="page pulse-wide">
      <div className="atmosphere" aria-hidden="true" />

      <header className="topbar">
        <span className="topbar-brand">{t.app.name}</span>
        <div className="topbar-actions">
          <Link className="lang" to="/login">
            {t.auth.loginCta}
          </Link>
          <Link className="lang" to="/register">
            {t.auth.registerCta}
          </Link>
          <button type="button" className="lang" onClick={onLocale}>
            {t.common.language}
          </button>
        </div>
      </header>

      <section className="hero">
        <p className="brand">{t.app.name}</p>
        <h1>{t.app.tagline}</h1>
        <p className="lede">{t.app.pulse}</p>
        <div className="cta-row">
          <Link className="btn primary" to="/login">
            {t.owner.enterDashboard}
          </Link>
          <button
            type="button"
            className="btn ghost"
            onClick={openLive}
            disabled={pending}
          >
            {t.home.ctaSecondary}
          </button>
        </div>
        <p className="hero-status" aria-live="polite">
          {connected
            ? t.home.connected
            : apiState === "loading"
              ? t.common.loading
              : `${t.home.notConnected} (${t.home.apiTarget}: ${api.baseUrl})`}
        </p>
      </section>

      {showLive ? (
        <section id="live" className="live">
          <div className="live-head">
            <h2>{connected ? t.home.connected : t.home.notConnected}</h2>
            <button
              type="button"
              className="btn ghost compact"
              onClick={() =>
                startTransition(() => {
                  void refresh();
                })
              }
            >
              {t.common.retry}
            </button>
          </div>

          <ul className="pulse-strip" aria-label="connection">
            <li>
              <span className="label">{t.home.apiLabel}</span>
              <span className={`dot ${apiState}`} />
              <strong>
                {apiState === "up" ? t.common.online : t.common.offline}
              </strong>
            </li>
            <li>
              <span className="label">{t.home.dbLabel}</span>
              <span className={`dot ${dbState}`} />
              <strong>
                {dbState === "up" ? t.common.online : t.common.offline}
              </strong>
            </li>
          </ul>

          {error ? <p className="error">{error}</p> : null}

          {overview ? (
            <div className="overview">
              <p className="eyebrow">{t.home.companyLabel}</p>
              <p className="company-name">{overview.name}</p>
              <p className="meta">
                {overview.branches[0]?.name ?? "—"}
                {overview.branches[0]?.address
                  ? ` · ${overview.branches[0].address}`
                  : ""}
              </p>
            </div>
          ) : null}

          <div className="buyers">
            <h3>{t.owner.publicCatalog}</h3>
            {products.length === 0 ? (
              <p className="empty">{t.owner.productsEmpty}</p>
            ) : (
              <ul className="catalog-list">
                {products.map((p) => (
                  <li key={p.id}>
                    <span className="shop">
                      {locale === "bn" && p.nameBn ? p.nameBn : p.name}
                    </span>
                    <span className="phone">৳{p.priceBdt}</span>
                    <span className="addr">{p.sku}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="buyers">
            <h3>{t.nav.buyers}</h3>
            {buyers.length === 0 ? (
              <p className="empty">{t.home.emptyBuyers}</p>
            ) : (
              <ul className="buyer-list">
                {buyers.map((buyer) => (
                  <li key={buyer.id}>
                    <div className="buyer-row static">
                      <span className="shop">{buyer.shopName}</span>
                      <span className="phone">{buyer.phone}</span>
                      <span className="addr">{buyer.address ?? "—"}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
