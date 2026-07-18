import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import { api, type PublicShop, type ShopProduct } from "../lib/api";
import {
  cartCount,
  loadCart,
  saveCart,
  upsertCartLine,
} from "../lib/shopCart";

type Props = { locale: LocaleCode; onLocale: () => void };

const FONT_STACK: Record<string, string> = {
  "source-sans": '"Source Sans 3", "Noto Sans Bengali", sans-serif',
  "noto-bengali": '"Noto Sans Bengali", "Source Sans 3", sans-serif',
  "dm-sans": '"DM Sans", "Source Sans 3", sans-serif',
  "libre-baskerville": '"Libre Baskerville", Georgia, serif',
};

export function PublicProductPage({ locale, onLocale }: Props) {
  const { companySlug = "", productId = "" } = useParams();
  const navigate = useNavigate();
  const t = getMessages(locale);
  const [shop, setShop] = useState<PublicShop | null>(null);
  const [product, setProduct] = useState<ShopProduct | null>(null);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    void Promise.all([
      api.publicShop(companySlug),
      api.publicShopProduct(companySlug, productId),
    ])
      .then(([s, p]) => {
        setShop(s.shop);
        setProduct(p.product);
        setCount(cartCount(loadCart(companySlug)));
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Not found"),
      );
  }, [companySlug, productId]);

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

  function addToCart() {
    if (!product) return;
    const next = upsertCartLine(
      loadCart(companySlug),
      {
        productId: product.id,
        name: product.name,
        nameBn: product.nameBn,
        sku: product.sku,
        category: product.category,
        unit: product.unit,
        priceBdt: product.priceBdt,
        imageUrl: product.imageUrl,
      },
      qty,
    );
    saveCart(companySlug, next);
    setCount(cartCount(next));
  }

  if (error) {
    return (
      <div className="shop-page shop-error">
        <p>{error}</p>
        <Link to={`/shop/${companySlug}`}>{t.shop.backToShop}</Link>
      </div>
    );
  }

  if (!shop || !product) {
    return (
      <div className="shop-page shop-loading">
        <p>{t.common.loading}</p>
      </div>
    );
  }

  const title = locale === "bn" && product.nameBn ? product.nameBn : product.name;

  return (
    <div className="shop-page" style={theme}>
      <header className="shop-topbar">
        <Link className="shop-brand-lockup" to={`/shop/${companySlug}`}>
          {shop.logoUrl ? (
            <img className="shop-logo-sm" src={shop.logoUrl} alt={shop.name} />
          ) : null}
          <span>{shop.name}</span>
        </Link>
        <div className="shop-topbar-actions">
          <Link className="lang" to={`/shop/${companySlug}/checkout`}>
            {t.shop.cart} ({count})
          </Link>
          <button type="button" className="lang" onClick={onLocale}>
            {t.common.language}
          </button>
        </div>
      </header>

      <section className="shop-product-detail">
        <div className="shop-product-detail-media">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={title} />
          ) : (
            <div className="shop-product-placeholder" />
          )}
        </div>
        <div className="shop-product-detail-body">
          <p className="muted tiny">{product.category}</p>
          <h1>{title}</h1>
          <p className="muted">SKU {product.sku}</p>
          <p className="shop-price">৳{product.priceBdt}</p>
          {product.description ? <p>{product.description}</p> : null}
          <label className="shop-qty">
            {t.shop.qty}
            <input
              type="number"
              min={1}
              max={product.stockQty ?? 999}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
          <div className="shop-cta-row">
            <button type="button" className="btn primary shop-cta" onClick={addToCart}>
              {t.shop.addToCart}
            </button>
            <button
              type="button"
              className="btn ghost shop-cta"
              onClick={() => {
                addToCart();
                void navigate(`/shop/${companySlug}/checkout`);
              }}
            >
              {t.shop.buyNow}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
