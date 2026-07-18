import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { Link, useParams } from "react-router-dom";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import {
  api,
  type DeliveryQuote,
  type PublicShop,
} from "../lib/api";
import {
  clearCart,
  loadCart,
  saveCart,
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
  const [form, setForm] = useState({
    shopName: "",
    clientName: "",
    phone: "",
    address: "",
    wardId: "",
    couponCode: "",
    note: "",
  });

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

  function setQty(productId: string, qty: number) {
    const next = lines
      .map((l) => (l.productId === productId ? { ...l, qty } : l))
      .filter((l) => l.qty > 0);
    setLines(next);
    saveCart(companySlug, next);
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
        <section className="shop-checkout panel-card">
          <h1>{t.shop.orderPlaced}</h1>
          <p>
            {t.shop.invoice}: <strong>{done.invoiceCode}</strong>
          </p>
          <p className="shop-price">৳{done.totalBdt}</p>
          <p className="muted">{t.shop.orderPlacedHint}</p>
          <Link className="btn primary" to={`/shop/${companySlug}`}>
            {t.shop.backToShop}
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="shop-page" style={theme}>
      <header className="shop-topbar">
        <Link className="shop-brand-lockup" to={`/shop/${companySlug}`}>
          {shop.logoUrl ? (
            <img className="shop-logo-sm" src={shop.logoUrl} alt={shop.name} />
          ) : null}
          <span>{shop.name}</span>
        </Link>
        <button type="button" className="lang" onClick={onLocale}>
          {t.common.language}
        </button>
      </header>

      <section className="shop-checkout">
        <h1>{t.shop.checkout}</h1>
        {error ? <p className="error">{error}</p> : null}

        {lines.length === 0 ? (
          <p className="muted">
            {t.shop.cartEmpty}{" "}
            <Link to={`/shop/${companySlug}`}>{t.shop.backToShop}</Link>
          </p>
        ) : (
          <div className="shop-checkout-grid">
            <ul className="shop-cart-list">
              {lines.map((l) => (
                <li key={l.productId}>
                  <div>
                    <strong>
                      {locale === "bn" && l.nameBn ? l.nameBn : l.name}
                    </strong>
                    <p className="muted tiny">
                      ৳{l.priceBdt} · {l.category}
                    </p>
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={l.qty}
                    onChange={(e) =>
                      setQty(l.productId, Math.max(1, Number(e.target.value) || 1))
                    }
                  />
                  <span>৳{(l.priceBdt * l.qty).toFixed(0)}</span>
                </li>
              ))}
            </ul>

            <form className="shop-checkout-form" onSubmit={onSubmit}>
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
