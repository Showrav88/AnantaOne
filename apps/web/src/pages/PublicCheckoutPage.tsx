import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { Link, useParams } from "react-router-dom";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import { makeToast, ShopToast, type ShopToastMessage } from "../components/ShopToast";
import {
  api,
  type DeliveryQuote,
  type PublicShop,
} from "../lib/api";
import {
  clearCart,
  loadCart,
  removeCartLine,
  saveCart,
  setCartLineQty,
  type CartLine,
} from "../lib/shopCart";

type Props = { locale: LocaleCode; onLocale: () => void };

const FONT_STACK: Record<string, string> = {
  "source-sans": '"Source Sans 3", "Noto Sans Bengali", sans-serif',
  "noto-bengali": '"Noto Sans Bengali", "Source Sans 3", sans-serif',
  "dm-sans": '"DM Sans", "Source Sans 3", sans-serif',
  "libre-baskerville": '"Libre Baskerville", Georgia, serif',
};

export function PublicCheckoutPage({ locale, onLocale }: Props) {
  const { companySlug = "" } = useParams();
  const t = getMessages(locale);
  const [shop, setShop] = useState<PublicShop | null>(null);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [quote, setQuote] = useState<DeliveryQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ invoiceCode: string; totalBdt: number } | null>(
    null,
  );
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState<ShopToastMessage | null>(null);
  const [form, setForm] = useState({
    shopName: "",
    clientName: "",
    phone: "",
    address: "",
    wardId: "",
    couponCode: "",
    note: "",
  });

  const clearToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    void api
      .publicShop(companySlug)
      .then((res) => {
        setShop(res.shop);
        const cart = loadCart(companySlug);
        setLines(cart);
        if (res.shop.wards[0] && !form.wardId) {
          setForm((f) => ({ ...f, wardId: res.shop.wards[0]!.id }));
        }
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Shop not found"),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companySlug]);

  useEffect(() => {
    if (!form.wardId || lines.length === 0) {
      setQuote(null);
      return;
    }
    const handle = window.setTimeout(() => {
      void api
        .shopQuote(companySlug, {
          wardId: form.wardId,
          couponCode: form.couponCode || null,
          lines: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
        })
        .then((res) => {
          setQuote(res.quote);
          setError(null);
        })
        .catch((err) => {
          setQuote(null);
          setError(err instanceof Error ? err.message : "Quote failed");
        });
    }, 280);
    return () => window.clearTimeout(handle);
  }, [companySlug, form.wardId, form.couponCode, lines]);

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

  function updateQty(productId: string, qty: number) {
    const next = setCartLineQty(lines, productId, qty);
    setLines(next);
    saveCart(companySlug, next);
    if (qty <= 0) {
      setToast(makeToast(t.shop.removedFromCart, "warn"));
    } else {
      setToast(makeToast(t.shop.cartUpdated, "info"));
    }
  }

  function removeLine(productId: string) {
    const next = removeCartLine(lines, productId);
    setLines(next);
    saveCart(companySlug, next);
    setToast(makeToast(t.shop.removedFromCart, "warn"));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!lines.length) return;
    setPending(true);
    setError(null);
    try {
      const res = await api.shopCheckout(companySlug, {
        shopName: form.shopName,
        clientName: form.clientName,
        phone: form.phone,
        address: form.address,
        wardId: form.wardId,
        couponCode: form.couponCode || null,
        note: form.note || null,
        lines: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
      });
      clearCart(companySlug);
      setLines([]);
      setDone({
        invoiceCode: res.order.invoiceCode,
        totalBdt: res.order.totalBdt,
      });
      setToast(makeToast(t.shop.orderPlaced, "ok"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setPending(false);
    }
  }

  if (!shop) {
    return (
      <div className="shop-page shop-loading">
        <p>{error ?? t.common.loading}</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="shop-page" style={theme}>
        <ShopToast key={toast?.id ?? 0} toast={toast} onDone={clearToast} />
        <section className="shop-checkout shop-checkout-done">
          <div className="shop-done-card">
            <p className="shop-stock-chip ok">{t.shop.orderPlaced}</p>
            <h1>{t.shop.invoice}</h1>
            <p className="shop-invoice-code">{done.invoiceCode}</p>
            <p className="shop-price shop-price-lg">৳{done.totalBdt}</p>
            <p className="muted">{t.shop.orderPlacedHint}</p>
            <Link className="btn primary" to={`/shop/${companySlug}`}>
              {t.shop.continueShopping}
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="shop-page" style={theme}>
      <ShopToast key={toast?.id ?? 0} toast={toast} onDone={clearToast} />

      <header className="shop-topbar">
        <Link className="shop-brand-lockup" to={`/shop/${companySlug}`}>
          {shop.logoUrl ? (
            <img className="shop-logo-sm" src={shop.logoUrl} alt={shop.name} />
          ) : null}
          <span>{shop.name}</span>
        </Link>
        <div className="shop-topbar-actions">
          <Link className="lang" to={`/shop/${companySlug}`}>
            {t.shop.continueShopping}
          </Link>
          <button type="button" className="lang" onClick={onLocale}>
            {t.common.language}
          </button>
        </div>
      </header>

      <section className="shop-checkout">
        <header className="shop-section-head">
          <h1>{t.shop.yourCart}</h1>
          <p>{t.shop.checkout}</p>
        </header>
        {error ? <p className="error">{error}</p> : null}

        {lines.length === 0 ? (
          <div className="shop-empty-cart">
            <p className="muted">{t.shop.cartEmpty}</p>
            <Link className="btn primary" to={`/shop/${companySlug}`}>
              {t.shop.backToShop}
            </Link>
          </div>
        ) : (
          <div className="shop-checkout-grid">
            <ul className="shop-cart-list modern">
              {lines.map((l) => {
                const title =
                  locale === "bn" && l.nameBn ? l.nameBn : l.name;
                return (
                  <li key={l.productId}>
                    <Link
                      className="shop-cart-media"
                      to={`/shop/${companySlug}/product/${l.productId}`}
                    >
                      {l.imageUrl ? (
                        <img src={l.imageUrl} alt={title} />
                      ) : (
                        <div className="shop-product-placeholder" />
                      )}
                    </Link>
                    <div className="shop-cart-body">
                      <Link
                        className="shop-cart-title"
                        to={`/shop/${companySlug}/product/${l.productId}`}
                      >
                        {title}
                      </Link>
                      <p className="muted tiny">
                        ৳{l.priceBdt} · {l.category}
                      </p>
                      <div className="shop-cart-controls">
                        <div className="shop-qty-stepper">
                          <button
                            type="button"
                            aria-label={t.shop.decreaseQty}
                            onClick={() => updateQty(l.productId, l.qty - 1)}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={l.qty}
                            onChange={(e) =>
                              updateQty(
                                l.productId,
                                Math.max(1, Number(e.target.value) || 1),
                              )
                            }
                          />
                          <button
                            type="button"
                            aria-label={t.shop.increaseQty}
                            onClick={() => updateQty(l.productId, l.qty + 1)}
                          >
                            +
                          </button>
                        </div>
                        <strong>৳{(l.priceBdt * l.qty).toFixed(0)}</strong>
                        <button
                          type="button"
                          className="shop-remove"
                          onClick={() => removeLine(l.productId)}
                        >
                          {t.shop.remove}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <form className="shop-checkout-form" onSubmit={onSubmit}>
              <h2>{t.shop.checkout}</h2>
              <label>
                {t.shop.fieldShopName}
                <input
                  required
                  value={form.shopName}
                  onChange={(e) =>
                    setForm({ ...form, shopName: e.target.value })
                  }
                />
              </label>
              <label>
                {t.shop.fieldClientName}
                <input
                  required
                  value={form.clientName}
                  onChange={(e) =>
                    setForm({ ...form, clientName: e.target.value })
                  }
                />
              </label>
              <label>
                {t.shop.fieldPhone}
                <input
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>
              <label>
                {t.shop.fieldAddress}
                <input
                  required
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                />
              </label>
              <label>
                {t.shop.fieldWard}
                <select
                  required
                  value={form.wardId}
                  onChange={(e) =>
                    setForm({ ...form, wardId: e.target.value })
                  }
                >
                  <option value="">{t.shop.selectWard}</option>
                  {shop.wards.map((w) => (
                    <option key={w.id} value={w.id}>
                      {locale === "bn" && w.nameBn ? w.nameBn : w.name}
                      {w.freeDelivery
                        ? ` — ${t.shop.freeDelivery}`
                        : ` — ৳${w.baseChargeBdt}+`}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t.shop.fieldCoupon}
                <input
                  value={form.couponCode}
                  placeholder={t.shop.couponHint}
                  onChange={(e) =>
                    setForm({ ...form, couponCode: e.target.value })
                  }
                />
              </label>
              <label>
                {t.shop.fieldNote}
                <input
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </label>

              {quote ? (
                <div className="shop-quote">
                  <p>
                    <span>{t.shop.subtotal}</span>
                    <strong>৳{quote.subtotalBdt}</strong>
                  </p>
                  <p>
                    <span>
                      {t.shop.delivery}
                      {quote.freeDelivery ? ` (${t.shop.freeDelivery})` : ""}
                    </span>
                    <strong>৳{quote.deliveryBdt}</strong>
                  </p>
                  <p>
                    <span>{t.shop.discount}</span>
                    <strong>৳{quote.discountBdt}</strong>
                  </p>
                  <p className="shop-quote-total">
                    <span>{t.shop.total}</span>
                    <strong>৳{quote.totalBdt}</strong>
                  </p>
                  {quote.breakdown.length ? (
                    <ul className="muted tiny">
                      {quote.breakdown.map((b) => (
                        <li key={b.category}>
                          {b.category}: {b.qty} × ৳{b.chargePerUnitBdt} = ৳
                          {b.lineDeliveryBdt}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              <button
                className="btn primary"
                type="submit"
                disabled={pending || !quote}
              >
                {t.shop.placeOrder}
              </button>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}
