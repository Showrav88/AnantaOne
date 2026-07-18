import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import { makeToast, ShopToast, type ShopToastMessage } from "../components/ShopToast";
import { api, type PublicShop } from "../lib/api";
import {
  cartCount,
  loadCart,
  saveCart,
  upsertCartLine,
} from "../lib/shopCart";

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

function inStock(qty: number | undefined) {
  return (qty ?? 0) >= 1;
}

export function PublicShopPage({ locale, onLocale }: Props) {
  const { companySlug = "" } = useParams();
  const navigate = useNavigate();
  const t = getMessages(locale);
  const [shop, setShop] = useState<PublicShop | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [toast, setToast] = useState<ShopToastMessage | null>(null);

  const clearToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!companySlug) return;
    void api
      .publicShop(companySlug)
      .then((res) => {
        setShop(res.shop);
        setCount(cartCount(loadCart(companySlug)));
      })
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

  function scrollCatalog() {
    document.getElementById("catalog")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function add(e: MouseEvent, p: PublicShop["products"][number]) {
    e.preventDefault();
    e.stopPropagation();
    if (!inStock(p.stockQty)) return;
    const next = upsertCartLine(loadCart(companySlug), {
      productId: p.id,
      name: p.name,
      nameBn: p.nameBn,
      sku: p.sku,
      category: p.category,
      unit: p.unit,
      priceBdt: p.priceBdt,
      imageUrl: p.imageUrl,
    });
    saveCart(companySlug, next);
    setCount(cartCount(next));
    setToast(makeToast(t.shop.addedToCart, "ok"));
  }

  if (error) {
    return (
      <div className="shop-page shop-error">
        <p>{error}</p>
        <button type="button" className="btn ghost" onClick={() => window.location.reload()}>
          {t.common.retry}
        </button>
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
      <ShopToast key={toast?.id ?? 0} toast={toast} onDone={clearToast} />

      <header className="shop-topbar">
        <div className="shop-brand-lockup">
          {shop.logoUrl ? (
            <img className="shop-logo-sm" src={shop.logoUrl} alt={shop.name} />
          ) : null}
          <span>{shop.name}</span>
        </div>
        <div className="shop-topbar-actions">
          <button type="button" className="lang" onClick={scrollCatalog}>
            {t.shop.catalog}
          </button>
          <Link className="lang shop-cart-pill" to={`/shop/${companySlug}/checkout`}>
            {t.shop.cart} <span>{count}</span>
          </Link>
          <button type="button" className="lang" onClick={onLocale}>
            {t.common.language}
          </button>
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
          <img className="shop-hero-media" src={shop.heroImageUrl} alt="" />
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
          {shop.siteSubhead ? (
            <p className="shop-lede">{shop.siteSubhead}</p>
          ) : null}
          <div className="shop-cta-row">
            <button
              type="button"
              className="btn primary shop-cta"
              onClick={scrollCatalog}
            >
              {t.shop.viewProducts}
            </button>
            <Link
              className="btn ghost shop-cta"
              to={`/shop/${companySlug}/checkout`}
            >
              {t.shop.cart} ({count})
            </Link>
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
            {shop.products.map((p) => {
              const available = inStock(p.stockQty);
              const title =
                locale === "bn" && p.nameBn ? p.nameBn : p.name;
              const detailPath = `/shop/${companySlug}/product/${p.id}`;
              return (
                <li key={p.id}>
                  <article
                    className={`shop-product-card ${available ? "" : "is-oos"}`}
                    role="link"
                    tabIndex={0}
                    onClick={() => void navigate(detailPath)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        void navigate(detailPath);
                      }
                    }}
                  >
                    <div className="shop-product-media">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={title} />
                      ) : (
                        <div
                          className="shop-product-placeholder"
                          aria-hidden="true"
                        />
                      )}
                      <span
                        className={`shop-stock-chip ${available ? "ok" : "oos"}`}
                      >
                        {available ? t.shop.available : t.shop.outOfStock}
                      </span>
                    </div>
                    <div className="shop-product-body">
                      <h3>{title}</h3>
                      <p className="muted tiny">
                        {p.sku} · {p.category}
                      </p>
                      {p.description ? (
                        <p className="shop-product-desc">{p.description}</p>
                      ) : null}
                      <div className="shop-product-foot">
                        <p className="shop-price">৳{p.priceBdt}</p>
                        <button
                          type="button"
                          className="btn primary compact"
                          disabled={!available}
                          onClick={(e) => add(e, p)}
                        >
                          {available ? t.shop.addToCart : t.shop.outOfStock}
                        </button>
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
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
