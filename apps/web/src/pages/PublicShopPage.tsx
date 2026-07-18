import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import { api, type PublicShop } from "../lib/api";

type Props = {
  locale: LocaleCode;
  onLocale: () => void;
};

const FONT_STACK: Record<string, string> = {
  "source-sans": '"Source Sans 3", "Noto Sans Bengali", sans-serif',
  "noto-bengali": '"Noto Sans Bengali", "Source Sans 3", sans-serif',
  "dm-sans": '"DM Sans", "Source Sans 3", sans-serif',
  "libre-baskerville": '"Libre Baskerville", Georgia, serif',
};

export function PublicShopPage({ locale, onLocale }: Props) {
  const { companySlug = "" } = useParams();
  const t = getMessages(locale);
  const [shop, setShop] = useState<PublicShop | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companySlug) return;
    void api
      .publicShop(companySlug)
      .then((res) => setShop(res.shop))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Shop not found"),
      );
  }, [companySlug]);

  const theme = useMemo(() => {
    if (!shop) return undefined;
    return {
      ["--shop-primary" as string]: shop.brandPrimary,
      ["--shop-accent" as string]: shop.brandAccent,
      ["--shop-bg" as string]: shop.brandBg,
      ["--shop-font" as string]:
        FONT_STACK[shop.brandFont] ?? FONT_STACK["source-sans"],
    } as CSSProperties;
  }, [shop]);

  if (error) {
    return (
      <div className="shop-page shop-error">
        <p>{error}</p>
        <Link to="/login">{t.auth.loginCta}</Link>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="shop-page shop-loading">
        <p>{t.common.loading}</p>
      </div>
    );
  }

  return (
    <div className="shop-page" style={theme}>
      <header className="shop-topbar">
        <div className="shop-brand-lockup">
          {shop.logoUrl ? (
            <img className="shop-logo-sm" src={shop.logoUrl} alt={shop.name} />
          ) : null}
          <span>{shop.name}</span>
        </div>
        <div className="shop-topbar-actions">
          <a className="lang" href="#catalog">
            {t.shop.catalog}
          </a>
          <button type="button" className="lang" onClick={onLocale}>
            {t.common.language}
          </button>
          <Link className="lang" to="/login">
            {t.auth.loginCta}
          </Link>
        </div>
      </header>

      <section className="shop-hero">
        {shop.heroVideoUrl ? (
          <video
            className="shop-hero-media"
            src={shop.heroVideoUrl}
            autoPlay
            muted
            loop
            playsInline
          />
        ) : shop.heroImageUrl ? (
          <img
            className="shop-hero-media"
            src={shop.heroImageUrl}
            alt=""
          />
        ) : (
          <div className="shop-hero-fallback" aria-hidden="true" />
        )}
        <div className="shop-hero-veil" aria-hidden="true" />
        <div className="shop-hero-copy">
          {shop.logoUrl ? (
            <img className="shop-logo-hero" src={shop.logoUrl} alt={shop.name} />
          ) : (
            <p className="shop-brand-name">{shop.name}</p>
          )}
          <h1>{shop.siteHeadline}</h1>
          {shop.siteSubhead ? <p className="shop-lede">{shop.siteSubhead}</p> : null}
          <div className="shop-cta-row">
            <a className="btn primary shop-cta" href="#catalog">
              {t.shop.viewProducts}
            </a>
            {shop.phone ? (
              <a className="btn ghost shop-cta" href={`tel:${shop.phone}`}>
                {shop.phone}
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <section id="catalog" className="shop-catalog">
        <header className="shop-section-head">
          <h2>{t.shop.catalog}</h2>
          <p>{t.shop.catalogHint}</p>
        </header>
        {shop.products.length === 0 ? (
          <p className="muted">{t.shop.catalogEmpty}</p>
        ) : (
          <ul className="shop-product-grid">
            {shop.products.map((p) => (
              <li key={p.id}>
                <div className="shop-product-media">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} />
                  ) : (
                    <div className="shop-product-placeholder" aria-hidden="true" />
                  )}
                </div>
                <div className="shop-product-body">
                  <h3>{locale === "bn" && p.nameBn ? p.nameBn : p.name}</h3>
                  <p className="muted tiny">{p.sku}</p>
                  {p.description ? (
                    <p className="shop-product-desc">{p.description}</p>
                  ) : null}
                  <p className="shop-price">৳{p.priceBdt}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="shop-foot">
        <div>
          <strong>{shop.name}</strong>
          {shop.address ? <p>{shop.address}</p> : null}
          {shop.phone ? <p>{shop.phone}</p> : null}
        </div>
        <p className="muted tiny">
          {t.shop.poweredBy} {t.app.name}
        </p>
      </footer>
    </div>
  );
}
