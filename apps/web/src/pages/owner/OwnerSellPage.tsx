import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import {
  confirmDetails,
  useConfirmAction,
} from "../../components/ConfirmActionDialog";
import { SalesInvoiceView } from "../../components/SalesInvoiceView";
import {
  api,
  type Product,
  type ProductionBatch,
  type SalesInvoice,
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
  catalogPriceBdt: number;
  unitPriceBdt: string;
  batchId: string;
  unitSerialCode?: string | null;
  batchCode?: string | null;
};

export function OwnerSellPage({ locale }: Props) {
  const t = getMessages(locale);
  const { confirm } = useConfirmAction();
  const user = getStoredUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const onlineOrderId = searchParams.get("onlineOrderId");
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
  const [onlineMeta, setOnlineMeta] = useState<{
    id: string;
    invoiceCode: string;
    phone: string | null;
    shopName: string | null;
    clientName: string | null;
  } | null>(null);
  const [pickProductId, setPickProductId] = useState("");
  const [pickQty, setPickQty] = useState("1");
  const [pickPrice, setPickPrice] = useState("");
  const [pickBatchId, setPickBatchId] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [invoice, setInvoice] = useState<SalesInvoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [scanQuery, setScanQuery] = useState("");
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
    setBuyers(
      buyerRes.buyers
        .filter((b) => b.isActive)
        .map((b) => ({ id: b.id, shopName: b.shopName, phone: b.phone })),
    );
    setOrders(orderRes.orders.slice(0, 12));
    if (!pickProductId && prod.products[0]) {
      setPickProductId(prod.products[0].id);
      setPickPrice(String(prod.products[0].priceBdt));
    }
    return {
      products: prod.products.filter((p) => p.isActive),
      batches: batchRes.batches,
    };
  }

  useEffect(() => {
    startTransition(() => {
      void (async () => {
        try {
          const catalog = await load();
          if (!onlineOrderId) return;
          const res = await api.owner.onlineOrder(onlineOrderId);
          const o = res.order as {
            id: string;
            invoiceCode: string;
            phone: string | null;
            shopName: string | null;
            clientName: string | null;
            buyerId: string | null;
            note: string | null;
            status: { code: string } | null;
            lines: Array<{
              productId: string;
              qty: number;
              unitPriceBdt: number;
              catalogPriceBdt: number;
              product: {
                name: string;
                nameBn: string | null;
                sku: string;
              } | null;
            }>;
          };
          if (o.status?.code !== "PENDING") {
            setError(t.owner.onlineSellNotPending);
            return;
          }
          setOnlineMeta({
            id: o.id,
            invoiceCode: o.invoiceCode,
            phone: o.phone,
            shopName: o.shopName,
            clientName: o.clientName,
          });
          setSourceCode("ONLINE");
          setBuyerId(o.buyerId ?? "");
          setNote(
            [
              o.note,
              `${o.shopName ?? ""} / ${o.clientName ?? ""}`.trim(),
              o.phone ? `☎ ${o.phone}` : "",
              `Online ${o.invoiceCode}`,
            ]
              .filter(Boolean)
              .join(" · "),
          );
          setLines(
            o.lines.map((l, i) => {
              const fefo = catalog.batches
                .filter(
                  (b) =>
                    b.productId === l.productId && b.qtyRemaining >= l.qty,
                )
                .sort((a, b) => {
                  const ae = a.expiresAt
                    ? new Date(a.expiresAt).getTime()
                    : Number.POSITIVE_INFINITY;
                  const be = b.expiresAt
                    ? new Date(b.expiresAt).getTime()
                    : Number.POSITIVE_INFINITY;
                  if (ae !== be) return ae - be;
                  return (
                    new Date(a.manufacturedAt).getTime() -
                    new Date(b.manufacturedAt).getTime()
                  );
                })[0];
              return {
                key: `online-${l.productId}-${i}`,
                productId: l.productId,
                productLabel:
                  locale === "bn" && l.product?.nameBn
                    ? l.product.nameBn
                    : (l.product?.name ?? l.productId),
                sku: l.product?.sku ?? "",
                qty: String(l.qty),
                catalogPriceBdt: l.catalogPriceBdt,
                unitPriceBdt: String(l.unitPriceBdt),
                batchId: fefo?.id ?? "",
              };
            }),
          );
          setOkMsg(t.owner.onlineSellLoaded);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed");
        }
      })();
    });
  }, [onlineOrderId]);

  const selectedProduct = products.find((p) => p.id === pickProductId);

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

  useEffect(() => {
    if (selectedProduct) {
      setPickPrice(String(selectedProduct.priceBdt));
    }
  }, [pickProductId]);

  const total = lines.reduce(
    (s, l) => s + Number(l.qty || 0) * Number(l.unitPriceBdt || 0),
    0,
  );

  function sourceLabel(code: typeof sourceCode) {
    if (code === "COUNTER") return t.owner.sourceCounter;
    if (code === "PHONE") return t.owner.sourcePhone;
    if (code === "ONLINE") return t.owner.sourceOnline;
    if (code === "WALK_IN") return t.owner.sourceWalkIn;
    return code;
  }

  function buyerLabel() {
    if (!buyerId) return t.owner.walkInBuyer;
    const buyer = buyers.find((b) => b.id === buyerId);
    return buyer ? `${buyer.shopName} (${buyer.phone})` : buyerId;
  }

  function lineSummary() {
    return lines
      .map((l) => {
        const batch = l.batchCode ?? batches.find((b) => b.id === l.batchId)?.batchCode ?? l.batchId;
        const lineTotal = Number(l.qty || 0) * Number(l.unitPriceBdt || 0);
        return `${l.productLabel} (${l.sku}) · ${t.owner.fieldBatch}: ${batch} · ${t.owner.fieldQty}: ${l.qty} · ৳${Number(l.unitPriceBdt || 0).toLocaleString()} = ৳${lineTotal.toLocaleString()}`;
      })
      .join("\n");
  }

  function addLine(opts?: {
    productId?: string;
    batchId?: string;
    qty?: number;
    unitSerialCode?: string | null;
    batchCode?: string | null;
    priceBdt?: number;
  }) {
    setError(null);
    const productId = opts?.productId ?? pickProductId;
    const product = products.find((p) => p.id === productId);
    if (!product) {
      setError(t.owner.sellNeedProduct);
      return;
    }
    const qty = opts?.qty ?? Number(pickQty);
    if (!(qty > 0)) {
      setError(t.owner.sellNeedQty);
      return;
    }
    const sellPrice =
      opts?.priceBdt != null ? opts.priceBdt : Number(pickPrice);
    if (!(sellPrice >= 0)) {
      setError(t.owner.sellNeedPrice);
      return;
    }
    const batchesForProduct = batches.filter(
      (b) => b.productId === product.id && b.qtyRemaining > 0,
    );
    const batch =
      batchesForProduct.find((b) => b.id === (opts?.batchId ?? pickBatchId)) ??
      batchesForProduct[0];
    if (!batch) {
      setError(t.owner.sellNeedBatch);
      return;
    }
    if (batch.qtyRemaining < qty) {
      setError(t.owner.sellBatchShort);
      return;
    }
    const serial = opts?.unitSerialCode?.toUpperCase() || null;
    if (serial && lines.some((l) => l.unitSerialCode === serial)) {
      setError(t.owner.scanUnitAlreadyInCart.replace("{code}", serial));
      return;
    }
    setPickProductId(product.id);
    setPickBatchId(batch.id);
    setPickPrice(String(sellPrice));
    if (serial) setPickQty("1");
    setLines((prev) => [
      ...prev,
      {
        key: `${product.id}-${batch.id}-${serial ?? Date.now()}`,
        productId: product.id,
        productLabel:
          locale === "bn" && product.nameBn ? product.nameBn : product.name,
        sku: product.sku,
        qty: String(qty),
        catalogPriceBdt: product.priceBdt,
        unitPriceBdt: String(sellPrice),
        batchId: batch.id,
        unitSerialCode: serial,
        batchCode: opts?.batchCode ?? batch.batchCode,
      },
    ]);
    setOkMsg(
      serial
        ? t.owner.scanUnitAdded
            .replace("{code}", serial)
            .replace("{batch}", batch.batchCode)
        : null,
    );
  }

  async function applyScan(raw: string) {
    setError(null);
    setOkMsg(null);
    try {
      const res = await api.owner.lookupUnitScan(raw);
      if (!res.product?.isActive) {
        setError(t.owner.scanProductInactive);
        return;
      }
      if (!res.batch) {
        setError(
          t.owner.scanNoBatch.replace("{sku}", res.product.sku),
        );
        setPickProductId(res.product.id);
        setPickBatchId("");
        setPickPrice(String(res.product.priceBdt));
        return;
      }
      if (res.kind === "unit" && res.canSell === false) {
        setError(
          t.owner.scanUnitNotSellable
            .replace("{code}", res.unit?.serialCode ?? "—")
            .replace("{status}", res.unit?.status ?? "—"),
        );
        setPickProductId(res.product.id);
        setPickBatchId(res.batch.id);
        setPickPrice(String(res.product.priceBdt));
        return;
      }
      if (
        res.kind === "tag" &&
        (res.sellableBatchCount === 0 || res.batch.qtyRemaining <= 0)
      ) {
        setError(
          t.owner.scanNoBatch.replace("{sku}", res.product.sku),
        );
        setPickProductId(res.product.id);
        setPickBatchId(res.batch.id);
        return;
      }

      addLine({
        productId: res.product.id,
        batchId: res.batch.id,
        qty: 1,
        unitSerialCode: res.unit?.serialCode ?? null,
        batchCode: res.batch.batchCode,
        priceBdt: res.product.priceBdt,
      });
      setScanQuery("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Scan failed";
      setError(msg);
    }
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
    for (const l of lines) {
      if (!l.batchId) {
        setError(t.owner.sellNeedBatch);
        return;
      }
    }
    const decision = await confirm({
      title: t.common.confirmActionTitle,
      message: onlineMeta
        ? t.owner.onlineSellConfirmHint
        : t.common.confirmActionMessage,
      tone: "info",
      confirmLabel: onlineMeta
        ? t.owner.onlineConfirmSellAction
        : t.owner.confirmSell,
      cancelLabel: t.common.cancel,
      details: confirmDetails(
        [
          { label: t.owner.fieldOrderSource, value: onlineMeta ? t.owner.sourceOnline : sourceLabel(sourceCode) },
          { label: t.owner.fieldBuyerShop, value: onlineMeta?.shopName ?? buyerLabel() },
          { label: t.owner.fieldContactName, value: onlineMeta?.clientName },
          { label: t.owner.fieldPhone, value: onlineMeta?.phone },
          { label: t.owner.fieldNote, value: note },
          { label: t.owner.invoiceLabel, value: onlineMeta?.invoiceCode },
          { label: t.owner.fieldLineTotal, value: lineSummary() },
          { label: t.owner.invoiceTotal, value: `৳${total.toLocaleString()}` },
        ],
        { skipEmpty: true },
      ),
    });
    if (!decision.ok) return;

    try {
      if (onlineMeta) {
        const res = await api.owner.acceptOnlineOrder(onlineMeta.id, {
          creditWallet: true,
          lines: lines.map((l) => ({
            productId: l.productId,
            qty: Number(l.qty),
            unitPriceBdt: Number(l.unitPriceBdt),
            batchId: l.batchId || null,
            unitSerialCode: l.unitSerialCode || null,
          })),
        });
        const orderId = String((res.order as { id: string }).id);
        const inv = await api.owner.orderInvoice(orderId);
        setInvoice(inv.invoice);
        setOkMsg(
          `${t.owner.onlineSellConfirmed} ৳${Number((res.order as { totalBdt: number }).totalBdt).toLocaleString()}`,
        );
        setLines([]);
        setNote("");
        setOnlineMeta(null);
        setSearchParams({});
        await load();
        return;
      }

      const res = await api.owner.confirmSell({
        sourceCode,
        buyerId: buyerId || null,
        note: note || null,
        lines: lines.map((l) => ({
          productId: l.productId,
          qty: Number(l.qty),
          unitPriceBdt: Number(l.unitPriceBdt),
          batchId: l.batchId || null,
          unitSerialCode: l.unitSerialCode || null,
        })),
      });
      const inv = await api.owner.orderInvoice(res.order.id);
      setInvoice(inv.invoice);
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

  async function onCancelSale() {
    if (!invoice || invoice.isReversed) return;
    setError(null);
    setOkMsg(null);
    const decision = await confirm({
      title: t.common.confirmDeleteTitle,
      message: t.owner.cancelSaleHint,
      tone: "danger",
      confirmLabel: t.owner.confirmCancelSale,
      cancelLabel: t.common.cancel,
      details: confirmDetails(
        [
          { label: t.common.fieldId, value: invoice.id },
          { label: t.owner.invoiceLabel, value: invoice.invoiceCode ?? invoice.invoiceNo },
          { label: t.owner.billTo, value: invoice.buyerName ?? t.owner.walkInBuyer },
          { label: t.owner.invoiceTotal, value: `৳${invoice.totalBdt.toLocaleString()}` },
        ],
        { skipEmpty: true },
      ),
      reasonLabel: t.owner.reverseReason,
      reasonPlaceholder: t.owner.reverseReasonHint,
      reasonMinLength: 5,
    });
    if (!decision.ok) return;

    try {
      const res = await api.owner.reverseOrder(invoice.id, decision.reason ?? "");
      const restockQty = (res.restocked ?? []).reduce((s, r) => s + r.qty, 0);
      setOkMsg(
        `${t.owner.reverseDone} · ${t.owner.cashDebited}: ৳${(res.cashDebitedBdt ?? invoice.totalBdt).toLocaleString()}${restockQty > 0 ? ` · +${restockQty} stock` : ""}`,
      );
      const inv = await api.owner.orderInvoice(invoice.id);
      setInvoice(inv.invoice);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed");
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
      <header className="owner-header no-print">
        <div>
          <p className="eyebrow">{t.owner.navSell}</p>
          <h1>{t.owner.sellTitle}</h1>
          <p className="muted">{t.owner.sellHint}</p>
          <p className="muted tiny">{t.owner.priceOverrideHint}</p>
        </div>
        <div className="header-links">
          <Link to="/owner/history">{t.owner.navHistory}</Link>
          <Link to="/owner/batches">{t.owner.navBatches}</Link>
          <Link to="/owner/tags">{t.owner.navTags}</Link>
        </div>
      </header>

      {error ? <p className="error-banner no-print">{error}</p> : null}
      {okMsg ? <p className="ok-banner no-print">{okMsg}</p> : null}

      {onlineMeta && !invoice ? (
        <div className="ok-banner no-print online-sell-banner">
          <strong>{t.owner.onlineSellLoaded}</strong>
          <div className="muted tiny">
            {onlineMeta.invoiceCode}
            {onlineMeta.shopName ? ` · ${onlineMeta.shopName}` : ""}
            {onlineMeta.clientName ? ` · ${onlineMeta.clientName}` : ""}
          </div>
          {onlineMeta.phone ? (
            <p className="tiny">
              <a className="cta secondary" href={`tel:${onlineMeta.phone}`}>
                {t.owner.onlineCallCustomer}: {onlineMeta.phone}
              </a>
            </p>
          ) : null}
          <p className="muted tiny">{t.owner.onlineSellConfirmHint}</p>
          <button
            type="button"
            className="linkish"
            onClick={() => {
              setOnlineMeta(null);
              setLines([]);
              setSearchParams({});
            }}
          >
            {t.owner.onlineSellClear}
          </button>
        </div>
      ) : null}

      {invoice ? (
        <div className="post-sell-invoice">
          <div className="invoice-actions no-print">
            <button
              type="button"
              className="cta"
              onClick={() => window.print()}
            >
              {t.owner.printInvoice}
            </button>
            <Link
              className="cta secondary"
              to={`/owner/history?order=${invoice.id}`}
            >
              {t.owner.openHistory}
            </Link>
            <button
              type="button"
              className="linkish"
              onClick={() => {
                setInvoice(null);
              }}
            >
              {t.owner.newSale}
            </button>
          </div>
          <SalesInvoiceView locale={locale} invoice={invoice} />
          {canSell && !invoice.isReversed ? (
            <section className="owner-form compact reverse-form no-print">
              <h2>{t.owner.cancelSale}</h2>
              <p className="muted tiny">{t.owner.cancelSaleHint}</p>
              <button
                type="button"
                className="cta danger"
                onClick={() => void onCancelSale()}
              >
                {t.owner.confirmCancelSale}
              </button>
            </section>
          ) : null}
        </div>
      ) : null}

      <form className="sell-layout no-print" onSubmit={onConfirm}>
        <section className="sell-panel panel-card">
          <h2>{t.owner.sellOrderMeta}</h2>
          <div className="owner-form compact">
            <label>
              {t.owner.fieldOrderSource}
              <select
                value={sourceCode}
                onChange={(e) =>
                  setSourceCode(e.target.value as typeof sourceCode)
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
            <label className="full">
              {t.owner.scanUnitLabel}
              <input
                value={scanQuery}
                placeholder={t.owner.scanUnitPlaceholder}
                autoComplete="off"
                onChange={(e) => setScanQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const q = scanQuery.trim();
                    if (q) void applyScan(q);
                  }
                }}
              />
            </label>
            <label>
              {t.owner.fieldProduct}
              <select
                value={pickProductId}
                onChange={(e) => setPickProductId(e.target.value)}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {locale === "bn" && p.nameBn ? p.nameBn : p.name} —{" "}
                    {p.sku} ({t.owner.catalogShort} ৳{p.priceBdt})
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
            <label>
              {t.owner.soldPrice}
              <input
                type="number"
                min={0}
                step="0.01"
                value={pickPrice}
                onChange={(e) => setPickPrice(e.target.value)}
              />
              {selectedProduct ? (
                <span className="muted tiny">
                  {t.owner.catalogPrice}: ৳{selectedProduct.priceBdt}
                </span>
              ) : null}
            </label>
            <button
              type="button"
              className="cta"
              onClick={() => addLine()}
              disabled={pending}
            >
              {t.owner.addLine}
            </button>
          </div>

          <div className="owner-table-wrap sell-cart-desktop">
            <table className="owner-table">
              <thead>
                <tr>
                  <th>{t.owner.fieldProduct}</th>
                  <th>{t.owner.fieldBatch}</th>
                  <th className="sell-col-qty">{t.owner.fieldQty}</th>
                  <th className="sell-col-money">{t.owner.catalogPrice}</th>
                  <th className="sell-col-qty">{t.owner.soldPrice}</th>
                  <th className="sell-col-money">{t.owner.fieldLineTotal}</th>
                  <th className="sell-col-action" />
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted">
                      {t.owner.cartEmpty}
                    </td>
                  </tr>
                ) : (
                  lines.map((l) => {
                    const sold = Number(l.unitPriceBdt || 0);
                    const overridden =
                      Math.abs(sold - l.catalogPriceBdt) > 0.0001;
                    const lineBatches = batches.filter(
                      (b) =>
                        b.productId === l.productId &&
                        (b.qtyRemaining > 0 || b.id === l.batchId),
                    );
                    return (
                      <tr key={l.key}>
                        <td>
                          <strong>{l.productLabel}</strong>
                          <div className="muted tiny">{l.sku}</div>
                          {l.unitSerialCode ? (
                            <div className="muted tiny">
                              QR {l.unitSerialCode}
                            </div>
                          ) : null}
                        </td>
                        <td>
                          <select
                            value={l.batchId}
                            disabled={Boolean(l.unitSerialCode)}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((x) =>
                                  x.key === l.key
                                    ? { ...x, batchId: e.target.value }
                                    : x,
                                ),
                              )
                            }
                          >
                            {lineBatches.length === 0 ? (
                              <option value="">{t.owner.noBatch}</option>
                            ) : (
                              lineBatches.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.batchCode} · {b.qtyRemaining}
                                </option>
                              ))
                            )}
                          </select>
                        </td>
                        <td className="sell-col-qty">
                          <input
                            className="qty-input"
                            type="number"
                            inputMode="decimal"
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
                        <td className="sell-col-money">
                          ৳{l.catalogPriceBdt.toLocaleString()}
                        </td>
                        <td className="sell-col-qty">
                          <input
                            className="qty-input"
                            type="number"
                            inputMode="decimal"
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
                          {overridden ? (
                            <div className="muted tiny price-override">
                              {t.owner.overridden}
                            </div>
                          ) : null}
                        </td>
                        <td className="sell-col-money">
                          ৳{(Number(l.qty || 0) * sold).toLocaleString()}
                        </td>
                        <td className="sell-col-action">
                          <button
                            type="button"
                            className="linkish"
                            onClick={() => removeLine(l.key)}
                          >
                            {t.owner.removeLine}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="sell-cart-mobile">
            {lines.length === 0 ? (
              <p className="muted">{t.owner.cartEmpty}</p>
            ) : (
              lines.map((l) => {
                const sold = Number(l.unitPriceBdt || 0);
                return (
                  <article key={l.key} className="sell-line-card">
                    <div className="sell-line-head">
                      <div>
                        <strong>{l.productLabel}</strong>
                        <div className="muted tiny">{l.sku}</div>
                      </div>
                      <button
                        type="button"
                        className="linkish"
                        onClick={() => removeLine(l.key)}
                      >
                        {t.owner.removeLine}
                      </button>
                    </div>
                    <div className="sell-line-fields">
                      <label className="full">
                        {t.owner.fieldBatch}
                        <select
                          value={l.batchId}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((x) =>
                                x.key === l.key
                                  ? { ...x, batchId: e.target.value }
                                  : x,
                              ),
                            )
                          }
                        >
                          {batches
                            .filter(
                              (b) =>
                                b.productId === l.productId &&
                                (b.qtyRemaining > 0 || b.id === l.batchId),
                            )
                            .map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.batchCode} · {b.qtyRemaining}
                              </option>
                            ))}
                          {!batches.some(
                            (b) =>
                              b.productId === l.productId &&
                              (b.qtyRemaining > 0 || b.id === l.batchId),
                          ) ? (
                            <option value="">{t.owner.noBatch}</option>
                          ) : null}
                        </select>
                      </label>
                      <label>
                        {t.owner.fieldQty}
                        <input
                          className="qty-input"
                          type="number"
                          inputMode="decimal"
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
                      </label>
                      <label>
                        {t.owner.soldPrice}
                        <input
                          className="qty-input"
                          type="number"
                          inputMode="decimal"
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
                      </label>
                    </div>
                    <p className="sell-line-total">
                      {t.owner.fieldLineTotal}: ৳
                      {(Number(l.qty || 0) * sold).toLocaleString()}
                    </p>
                  </article>
                );
              })
            )}
          </div>

          <div className="sell-footer">
            <p className="wallet-amount">৳{total.toLocaleString()}</p>
            <button
              type="submit"
              className="cta"
              disabled={pending || !lines.length}
            >
              {onlineMeta
                ? t.owner.onlineConfirmSellAction
                : t.owner.confirmSell}
            </button>
          </div>
        </section>

        <aside className="sell-side panel-card">
          <h2>{t.owner.recentOrders}</h2>
          <ul className="plain-list">
            {orders.length === 0 ? (
              <li className="muted">{t.owner.ordersEmpty}</li>
            ) : (
              orders.map((o) => (
                <li key={o.id}>
                  <Link to={`/owner/history?order=${o.id}`}>
                    <span>
                      {o.buyerName ?? t.owner.walkInBuyer}
                      <div className="muted tiny">
                        {o.isReversed || o.status?.code === "REVERSED"
                          ? t.owner.statusReversed
                          : o.source?.code}{" "}
                        · {o.lines.length} SKU
                      </div>
                    </span>
                    <span>৳{o.totalBdt.toLocaleString()}</span>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </aside>
      </form>
    </div>
  );
}
