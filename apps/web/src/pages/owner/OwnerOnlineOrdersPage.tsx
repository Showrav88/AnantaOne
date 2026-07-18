import { useEffect, useState, useTransition } from "react";
import { Link } from "react-router-dom";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import { api } from "../../lib/api";
import { getStoredUser } from "../../lib/session";

type Props = { locale: LocaleCode };

type OnlineOrder = {
  id: string;
  invoiceCode: string;
  shopName: string | null;
  clientName: string | null;
  phone: string | null;
  address: string | null;
  totalBdt: number;
  deliveryBdt: number;
  discountBdt: number;
  subtotalBdt: number;
  couponCode: string | null;
  orderedAt: string;
  status: { code: string; nameEn: string; nameBn: string } | null;
  ward: { name: string; nameBn: string | null; freeDelivery: boolean } | null;
  lines: Array<{
    qty: number;
    unitPriceBdt: number;
    product: { name: string; nameBn: string | null; sku: string } | null;
  }>;
};

export function OwnerOnlineOrdersPage({ locale }: Props) {
  const t = getMessages(locale);
  const user = getStoredUser();
  const canWrite = user?.role.code === "OWNER" || user?.role.code === "MANAGER";
  const [orders, setOrders] = useState<OnlineOrder[]>([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function load(status?: string) {
    const res = await api.owner.onlineOrders(status || undefined);
    setOrders(res.orders as unknown as OnlineOrder[]);
  }

  useEffect(() => {
    function refresh() {
      startTransition(() => {
        void load(filter).catch((err) =>
          setError(err instanceof Error ? err.message : "Failed"),
        );
      });
    }
    refresh();
    window.addEventListener("anantaone:branch-change", refresh);
    return () => window.removeEventListener("anantaone:branch-change", refresh);
  }, [filter]);

  async function accept(id: string) {
    setError(null);
    try {
      await api.owner.acceptOnlineOrder(id);
      await load(filter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Accept failed");
    }
  }

  async function setStatus(id: string, statusCode: string) {
    setError(null);
    try {
      await api.owner.setOnlineOrderStatus(id, statusCode);
      await load(filter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  return (
    <div className="owner-page">
      <header className="owner-header">
        <div>
          <p className="eyebrow">{t.owner.navOnlineOrders}</p>
          <h1>{t.owner.onlineOrdersTitle}</h1>
          <p className="muted">{t.owner.onlineOrdersHint}</p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label={t.owner.fieldStatus}
        >
          <option value="">{t.owner.filterAll}</option>
          <option value="PENDING">PENDING</option>
          <option value="ACCEPTED">ACCEPTED</option>
          <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
          <option value="DELIVERED">DELIVERED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
      </header>

      {error ? <p className="error">{error}</p> : null}
      {pending && orders.length === 0 ? (
        <p className="muted">{t.common.loading}</p>
      ) : null}

      <ul className="online-order-list">
        {orders.map((o) => (
          <li key={o.id} className="panel-card">
            <div className="online-order-head">
              <div>
                <strong>{o.invoiceCode}</strong>
                <p className="muted tiny">
                  {o.status
                    ? locale === "bn"
                      ? o.status.nameBn
                      : o.status.nameEn
                    : "—"}{" "}
                  · {new Date(o.orderedAt).toLocaleString()}
                </p>
              </div>
              <strong className="shop-price">৳{o.totalBdt}</strong>
            </div>
            <p>
              <strong>{o.shopName}</strong> — {o.clientName} · {o.phone}
            </p>
            <p className="muted">{o.address}</p>
            <p className="muted tiny">
              {o.ward
                ? `${locale === "bn" && o.ward.nameBn ? o.ward.nameBn : o.ward.name}${o.ward.freeDelivery ? ` (${t.shop.freeDelivery})` : ""}`
                : "—"}
              {o.couponCode ? ` · ${t.shop.fieldCoupon}: ${o.couponCode}` : ""}
            </p>
            <ul className="muted tiny">
              {o.lines.map((l, i) => (
                <li key={i}>
                  {l.qty} ×{" "}
                  {locale === "bn" && l.product?.nameBn
                    ? l.product.nameBn
                    : l.product?.name}{" "}
                  @ ৳{l.unitPriceBdt}
                </li>
              ))}
            </ul>
            <p className="muted tiny">
              {t.shop.subtotal} ৳{o.subtotalBdt} · {t.shop.delivery} ৳
              {o.deliveryBdt} · {t.shop.discount} ৳{o.discountBdt}
            </p>
            {canWrite ? (
              <div className="media-actions">
                {o.status?.code === "PENDING" ? (
                  <>
                    {o.phone ? (
                      <a
                        className="btn ghost compact"
                        href={`tel:${o.phone}`}
                      >
                        {t.owner.onlineCallCustomer}
                      </a>
                    ) : null}
                    <Link
                      className="btn primary compact"
                      to={`/owner/sell?onlineOrderId=${encodeURIComponent(o.id)}`}
                    >
                      {t.owner.onlineConfirmSell}
                    </Link>
                    <button
                      type="button"
                      className="btn ghost compact"
                      onClick={() => void accept(o.id)}
                    >
                      {t.owner.onlineQuickAccept}
                    </button>
                    <button
                      type="button"
                      className="btn ghost compact dark"
                      onClick={() => void setStatus(o.id, "CANCELLED")}
                    >
                      {t.common.cancel}
                    </button>
                  </>
                ) : null}
                {o.status?.code === "ACCEPTED" ? (
                  <button
                    type="button"
                    className="btn ghost compact"
                    onClick={() => void setStatus(o.id, "OUT_FOR_DELIVERY")}
                  >
                    {t.owner.markOutForDelivery}
                  </button>
                ) : null}
                {o.status?.code === "OUT_FOR_DELIVERY" ? (
                  <button
                    type="button"
                    className="btn ghost compact"
                    onClick={() => void setStatus(o.id, "DELIVERED")}
                  >
                    {t.owner.markDelivered}
                  </button>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {orders.length === 0 && !pending ? (
        <p className="muted">{t.owner.onlineOrdersEmpty}</p>
      ) : null}
    </div>
  );
}
