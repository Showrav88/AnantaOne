import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import {
  api,
  type Product,
  type ProductionBatch,
  type SalesOrder,
} from "../../lib/api";
import { getStoredUser } from "../../lib/session";

type Props = { locale: LocaleCode };

type CartLine = {
  key: string;
  productId: string;
  productLabel: string;
  sku: string;
  qty: string;
  unitPriceBdt: string;
  batchId: string;
};

export function OwnerSellPage({ locale }: Props) {
  const t = getMessages(locale);
  const user = getStoredUser();
  const canSell =
    user?.role.code === "OWNER" || user?.role.code === "MANAGER";

  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [buyers, setBuyers] = useState<
    Array<{ id: string; shopName: string; phone: string }>
  >([]);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [sourceCode, setSourceCode] = useState<
    "PHONE" | "ONLINE" | "WALK_IN" | "COUNTER"
  >("COUNTER");
  const [buyerId, setBuyerId] = useState("");
  const [note, setNote] = useState("");
  const [pickProductId, setPickProductId] = useState("");
  const [pickQty, setPickQty] = useState("1");
  const [pickBatchId, setPickBatchId] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [lastOrder, setLastOrder] = useState<SalesOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function load() {
    const [prod, batchRes, buyerRes, orderRes] = await Promise.all([
      api.owner.products(),
      api.owner.batches(),
      api.owner.buyers(),
      api.owner.orders(),
    ]);
    setProducts(prod.products.filter((p) => p.isActive));
    setBatches(batchRes.batches);
    setBuyers(buyerRes.buyers);
    setOrders(orderRes.orders.slice(0, 12));
    if (!pickProductId && prod.products[0]) {
      setPickProductId(prod.products[0].id);
    }
  }

  useEffect(() => {
    startTransition(() => {
      void load().catch((err) =>
        setError(err instanceof Error ? err.message : "Failed"),
      );
    });
  }, []);

  const productBatches = useMemo(
    () =>
      batches.filter(
        (b) => b.productId === pickProductId && b.qtyRemaining > 0,
      ),
    [batches, pickProductId],
  );

  useEffect(() => {
    if (productBatches[0]) setPickBatchId(productBatches[0].id);
    else setPickBatchId("");
  }, [pickProductId, productBatches]);

  const total = lines.reduce(
    (s, l) => s + Number(l.qty || 0) * Number(l.unitPriceBdt || 0),
    0,
  );

  function addLine() {
    setError(null);
    const product = products.find((p) => p.id === pickProductId);
    if (!product) {
      setError(t.owner.sellNeedProduct);
      return;
    }
    const qty = Number(pickQty);
    if (!(qty > 0)) {
      setError(t.owner.sellNeedQty);
      return;
    }
    const batch =
      productBatches.find((b) => b.id === pickBatchId) ?? productBatches[0];
    if (!batch) {
      setError(t.owner.sellNeedBatch);
      return;
    }
    if (batch.qtyRemaining < qty) {
      setError(t.owner.sellBatchShort);
      return;
    }
    setLines((prev) => [
      ...prev,
      {
        key: `${product.id}-${batch.id}-${Date.now()}`,
        productId: product.id,
        productLabel:
          locale === "bn" && product.nameBn ? product.nameBn : product.name,
        sku: product.sku,
        qty: String(qty),
        unitPriceBdt: String(product.priceBdt),
        batchId: batch.id,
      },
    ]);
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  async function onConfirm(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);
    if (!lines.length) {
      setError(t.owner.sellNeedLines);
      return;
    }
    try {
      const res = await api.owner.confirmSell({
        sourceCode,
        buyerId: buyerId || null,
        note: note || null,
        lines: lines.map((l) => ({
          productId: l.productId,
          qty: Number(l.qty),
          unitPriceBdt: Number(l.unitPriceBdt),
          batchId: l.batchId || null,
        })),
      });
      setLastOrder(res.order);
      setOkMsg(
        `${t.owner.sellConfirmed} ৳${res.order.totalBdt.toLocaleString()}`,
      );
      setLines([]);
      setNote("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  if (!canSell) {
    return (
      <div className="owner-page">
        <p className="muted">{t.owner.readOnlyHint}</p>
      </div>
    );
  }

  return (
    <div className="owner-page">
      <header className="owner-header">
        <div>
          <p className="eyebrow">{t.owner.navSell}</p>
          <h1>{t.owner.sellTitle}</h1>
          <p className="muted">{t.owner.sellHint}</p>
        </div>
        <div className="header-links">
          <Link to="/owner/batches">{t.owner.navBatches}</Link>
          <Link to="/owner/tags">{t.owner.navTags}</Link>
        </div>
      </header>

      {error ? <p className="error-banner">{error}</p> : null}
      {okMsg ? <p className="ok-banner">{okMsg}</p> : null}

      <form className="sell-layout" onSubmit={onConfirm}>
        <section className="sell-panel">
          <h2>{t.owner.sellOrderMeta}</h2>
          <div className="owner-form compact">
            <label>
              {t.owner.fieldOrderSource}
              <select
                value={sourceCode}
                onChange={(e) =>
                  setSourceCode(
                    e.target.value as typeof sourceCode,
                  )
                }
              >
                <option value="COUNTER">{t.owner.sourceCounter}</option>
                <option value="PHONE">{t.owner.sourcePhone}</option>
                <option value="ONLINE">{t.owner.sourceOnline}</option>
                <option value="WALK_IN">{t.owner.sourceWalkIn}</option>
              </select>
            </label>
            <label>
              {t.owner.fieldBuyerShop}
              <select
                value={buyerId}
                onChange={(e) => setBuyerId(e.target.value)}
              >
                <option value="">{t.owner.walkInBuyer}</option>
                {buyers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.shopName} ({b.phone})
                  </option>
                ))}
              </select>
            </label>
            <label className="full">
              {t.owner.fieldNote}
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </div>

          <h2>{t.owner.sellAddLines}</h2>
          <div className="owner-form compact">
            <label>
              {t.owner.fieldProduct}
              <select
                value={pickProductId}
                onChange={(e) => setPickProductId(e.target.value)}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {locale === "bn" && p.nameBn ? p.nameBn : p.name} —{" "}
                    {p.sku} (৳{p.priceBdt})
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t.owner.fieldBatch}
              <select
                value={pickBatchId}
                onChange={(e) => setPickBatchId(e.target.value)}
              >
                {productBatches.length === 0 ? (
                  <option value="">{t.owner.noBatch}</option>
                ) : (
                  productBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.batchCode} · left {b.qtyRemaining}
                      {b.expiresAt
                        ? ` · exp ${new Date(b.expiresAt).toLocaleDateString()}`
                        : ""}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label>
              {t.owner.fieldQty}
              <input
                type="number"
                min={0.01}
                step="0.01"
                value={pickQty}
                onChange={(e) => setPickQty(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="cta"
              onClick={addLine}
              disabled={pending}
            >
              {t.owner.addLine}
            </button>
          </div>

          <div className="owner-table-wrap">
            <table className="owner-table">
              <thead>
                <tr>
                  <th>{t.owner.fieldProduct}</th>
                  <th>{t.owner.fieldQty}</th>
                  <th>{t.owner.fieldPrice}</th>
                  <th>{t.owner.fieldLineTotal}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      {t.owner.cartEmpty}
                    </td>
                  </tr>
                ) : (
                  lines.map((l) => (
                    <tr key={l.key}>
                      <td>
                        <strong>{l.productLabel}</strong>
                        <div className="muted tiny">{l.sku}</div>
                      </td>
                      <td>
                        <input
                          className="qty-input"
                          type="number"
                          min={0.01}
                          step="0.01"
                          value={l.qty}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((x) =>
                                x.key === l.key
                                  ? { ...x, qty: e.target.value }
                                  : x,
                              ),
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="qty-input"
                          type="number"
                          min={0}
                          step="0.01"
                          value={l.unitPriceBdt}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((x) =>
                                x.key === l.key
                                  ? { ...x, unitPriceBdt: e.target.value }
                                  : x,
                              ),
                            )
                          }
                        />
                      </td>
                      <td>
                        ৳
                        {(
                          Number(l.qty || 0) * Number(l.unitPriceBdt || 0)
                        ).toLocaleString()}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="linkish"
                          onClick={() => removeLine(l.key)}
                        >
                          {t.owner.removeLine}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="sell-footer">
            <p className="wallet-amount">৳{total.toLocaleString()}</p>
            <button type="submit" className="cta" disabled={pending || !lines.length}>
              {t.owner.confirmSell}
            </button>
          </div>
        </section>

        <aside className="sell-side">
          <h2>{t.owner.recentOrders}</h2>
          <ul className="plain-list">
            {orders.length === 0 ? (
              <li className="muted">{t.owner.ordersEmpty}</li>
            ) : (
              orders.map((o) => (
                <li key={o.id}>
                  <span>
                    {o.buyerName ?? t.owner.walkInBuyer}
                    <div className="muted tiny">
                      {o.source?.code} · {o.lines.length} SKU
                    </div>
                  </span>
                  <span>৳{o.totalBdt.toLocaleString()}</span>
                </li>
              ))
            )}
          </ul>

          {lastOrder ? (
            <div className="last-order">
              <h2>{t.owner.lastSale}</h2>
              <p className="muted">
                {lastOrder.lines
                  .map(
                    (l) =>
                      `${l.product?.sku ?? "?"}×${l.qty} (${l.batch?.batchCode ?? ""})`,
                  )
                  .join(", ")}
              </p>
              <Link to="/owner/tags">{t.owner.printTagsHint}</Link>
            </div>
          ) : null}
        </aside>
      </form>
    </div>
  );
}
