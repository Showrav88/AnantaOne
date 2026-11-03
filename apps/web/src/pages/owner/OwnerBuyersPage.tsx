import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { Link } from "react-router-dom";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import {
  confirmDetails,
  useConfirmAction,
} from "../../components/ConfirmActionDialog";
import { api, type BuyerRow } from "../../lib/api";
import { getStoredUser } from "../../lib/session";

type Props = { locale: LocaleCode };

const empty = {
  shopName: "",
  contactName: "",
  phone: "",
  address: "",
  wardId: "",
};

type BuyerDetail = {
  buyer: BuyerRow;
  analytics: {
    orderCount: number;
    totalSpentBdt: number;
    onlineSpentBdt: number;
    counterSpentBdt: number;
    lastOrderAt: string | null;
    products: Array<{
      productId: string;
      name: string;
      nameBn: string | null;
      sku: string;
      qty: number;
      lineTotalBdt: number;
      orderCount: number;
    }>;
    recentOrders: Array<{
      id: string;
      invoiceCode: string;
      orderedAt: string;
      totalBdt: number;
      subtotalBdt: number;
      source: { code: string; nameEn: string; nameBn: string } | null;
      status: { code: string; nameEn: string; nameBn: string } | null;
      lines: Array<{
        productId: string;
        qty: number;
        unitPriceBdt: number;
        lineTotalBdt: number;
        product: {
          id: string;
          name: string;
          nameBn: string | null;
          sku: string;
        } | null;
      }>;
    }>;
  };
};

export function OwnerBuyersPage({ locale }: Props) {
  const t = getMessages(locale);
  const { confirm } = useConfirmAction();
  const user = getStoredUser();
  const canWrite = user?.role.code === "OWNER" || user?.role.code === "MANAGER";
  const [buyers, setBuyers] = useState<BuyerRow[]>([]);
  const [wards, setWards] = useState<
    Array<{ id: string; name: string; nameBn: string | null }>
  >([]);
  const [analytics, setAnalytics] = useState<{
    buyerCount: number;
    totalRevenueBdt: number;
    buyers: Array<{ id: string; onlineSpentBdt: number }>;
  } | null>(null);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BuyerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function load() {
    const [b, w, a] = await Promise.all([
      api.owner.buyers(),
      api.owner.deliveryWards(),
      api.owner.buyerAnalytics().catch(() => null),
    ]);
    setBuyers(b.buyers);
    setWards(w.wards);
    if (a) {
      setAnalytics({
        buyerCount: a.analytics.buyerCount,
        totalRevenueBdt: a.analytics.totalRevenueBdt,
        buyers: a.analytics.buyers.map((row) => ({
          id: row.id,
          onlineSpentBdt: row.onlineSpentBdt,
        })),
      });
    }
  }

  async function loadDetail(id: string) {
    setDetailLoading(true);
    setError(null);
    try {
      const res = await api.owner.buyerDetailAnalytics(id);
      setDetail({ buyer: res.buyer, analytics: res.analytics });
      setSelectedId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    startTransition(() => {
      void load().catch((err) =>
        setError(err instanceof Error ? err.message : "Failed"),
      );
    });
  }, []);

  const filteredBuyers = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/\s+/g, "");
    return buyers.filter((b) => {
      if (!showInactive && !b.isActive) return false;
      if (!q) return true;
      const phone = b.phone.toLowerCase().replace(/\s+/g, "");
      const shop = b.shopName.toLowerCase();
      const contact = (b.contactName ?? "").toLowerCase();
      return (
        phone.includes(q) ||
        shop.includes(search.trim().toLowerCase()) ||
        contact.includes(search.trim().toLowerCase())
      );
    });
  }, [buyers, search, showInactive]);

  function resetForm() {
    setForm(empty);
    setEditingId(null);
  }

  function startEdit(b: BuyerRow) {
    setEditingId(b.id);
    setForm({
      shopName: b.shopName,
      contactName: b.contactName ?? "",
      phone: b.phone,
      address: b.address ?? "",
      wardId: b.wardId ?? "",
    });
    setError(null);
    setOkMsg(null);
  }

  function wardLabel(id: string | null | undefined) {
    if (!id) return "—";
    const ward = wards.find((w) => w.id === id);
    if (!ward) return id;
    return locale === "bn" && ward.nameBn ? ward.nameBn : ward.name;
  }

  function buyerDetails(b: BuyerRow) {
    return confirmDetails(
      [
        { label: t.common.fieldId, value: b.id },
        { label: t.owner.fieldShopName, value: b.shopName },
        { label: t.owner.fieldContactName, value: b.contactName },
        { label: t.owner.fieldPhone, value: b.phone },
        {
          label: t.owner.fieldWard,
          value: b.ward
            ? locale === "bn" && b.ward.nameBn
              ? b.ward.nameBn
              : b.ward.name
            : b.wardId,
        },
      ],
      { skipEmpty: true },
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);
    try {
      const body = {
        shopName: form.shopName,
        contactName: form.contactName || null,
        phone: form.phone,
        address: form.address || null,
        wardId: form.wardId || null,
      };
      const decision = await confirm({
        title: editingId
          ? t.common.confirmUpdateTitle
          : t.common.confirmCreateTitle,
        message: editingId
          ? t.common.confirmUpdateMessage
          : t.common.confirmCreateMessage,
        tone: editingId ? "update" : "create",
        confirmLabel: editingId
          ? t.common.confirmUpdate
          : t.common.confirmCreate,
        cancelLabel: t.common.cancel,
        details: confirmDetails(
          [
            ...(editingId
              ? [{ label: t.common.fieldId, value: editingId }]
              : []),
            { label: t.owner.fieldShopName, value: body.shopName },
            { label: t.owner.fieldContactName, value: body.contactName },
            { label: t.owner.fieldPhone, value: body.phone },
            { label: t.owner.fieldAddress, value: body.address },
            { label: t.owner.fieldWard, value: wardLabel(body.wardId) },
          ],
          { skipEmpty: true },
        ),
      });
      if (!decision.ok) return;

      if (editingId) {
        await api.owner.updateBuyer(editingId, body);
        setOkMsg(t.owner.buyerUpdated);
      } else {
        await api.owner.createBuyer(body);
      }
      resetForm();
      await load();
      if (selectedId) await loadDetail(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function confirmDeactivate(b: BuyerRow) {
    setError(null);
    const decision = await confirm({
      title: t.owner.deactivateBuyerTitle,
      message: t.owner.deactivateBuyerHint.replace("{name}", b.shopName),
      tone: "danger",
      confirmLabel: t.owner.confirmDeactivateBuyer,
      cancelLabel: t.common.cancel,
      details: buyerDetails(b),
    });
    if (!decision.ok) return;

    try {
      await api.owner.updateBuyer(b.id, { isActive: false });
      if (editingId === b.id) resetForm();
      setOkMsg(t.owner.buyerDeactivated);
      await load();
      if (selectedId === b.id) await loadDetail(b.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function reactivateBuyer(b: BuyerRow) {
    setError(null);
    setOkMsg(null);
    const decision = await confirm({
      title: t.common.confirmActionTitle,
      message: t.common.confirmActionMessage,
      tone: "info",
      confirmLabel: t.common.confirmProceed,
      cancelLabel: t.common.cancel,
      details: buyerDetails(b),
    });
    if (!decision.ok) return;

    try {
      await api.owner.updateBuyer(b.id, { isActive: true });
      setOkMsg(t.owner.buyerReactivated);
      await load();
      if (selectedId === b.id) await loadDetail(b.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="owner-page">
      <header className="owner-header">
        <div>
          <p className="eyebrow">{t.owner.navBuyers}</p>
          <h1>{t.owner.buyersTitle}</h1>
          <p className="muted">{t.owner.buyersHint}</p>
          <p className="muted tiny">{t.owner.selectBuyerHint}</p>
        </div>
        <div className="header-links">
          <Link className="btn ghost" to="/owner/delivery">
            {t.owner.navDelivery}
          </Link>
          <Link className="btn ghost" to="/owner/sell">
            {t.owner.navSell}
          </Link>
        </div>
      </header>

      {analytics ? (
        <section className="stat-grid">
          <article>
            <p>{t.owner.statBuyers}</p>
            <strong>{analytics.buyerCount}</strong>
          </article>
          <article>
            <p>{t.owner.buyerRevenue}</p>
            <strong>৳{analytics.totalRevenueBdt.toLocaleString()}</strong>
          </article>
        </section>
      ) : null}

      {okMsg ? <p className="ok">{okMsg}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {canWrite ? (
        <form
          className="owner-form compact"
          autoComplete="off"
          onSubmit={onSubmit}
        >
          <label>
            {t.owner.fieldShopName}
            <input
              required
              name="buyerShopName"
              autoComplete="off"
              value={form.shopName}
              onChange={(e) => setForm({ ...form, shopName: e.target.value })}
            />
          </label>
          <label>
            {t.owner.fieldContactName}
            <input
              name="buyerContactName"
              autoComplete="off"
              value={form.contactName}
              onChange={(e) =>
                setForm({ ...form, contactName: e.target.value })
              }
            />
          </label>
          <label>
            {t.owner.fieldPhone}
            <input
              required
              name="buyerPhone"
              type="tel"
              autoComplete="off"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>
          <label>
            {t.owner.fieldAddress}
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </label>
          <label>
            {t.owner.fieldWard}
            <select
              value={form.wardId}
              onChange={(e) => setForm({ ...form, wardId: e.target.value })}
            >
              <option value="">—</option>
              {wards.map((w) => (
                <option key={w.id} value={w.id}>
                  {locale === "bn" && w.nameBn ? w.nameBn : w.name}
                </option>
              ))}
            </select>
          </label>
          <div className="form-actions">
            <button className="btn primary" type="submit" disabled={pending}>
              {editingId ? t.common.save : t.owner.addBuyer}
            </button>
            {editingId ? (
              <button type="button" className="btn ghost" onClick={resetForm}>
                {t.common.cancel}
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      <div className="owner-form compact" style={{ marginBottom: "0.75rem" }}>
        <label className="full">
          {t.owner.searchBuyers}
          <input
            type="search"
            value={search}
            placeholder="01XXXXXXXXX"
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          <select
            value={showInactive ? "all" : "active"}
            onChange={(e) => setShowInactive(e.target.value === "all")}
          >
            <option value="active">{t.owner.filterActiveBuyers}</option>
            <option value="all">{t.owner.filterAllBuyers}</option>
          </select>
        </label>
      </div>

      <div className="buyers-layout">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t.owner.fieldShopName}</th>
                <th>{t.owner.fieldContactName}</th>
                <th>{t.owner.fieldPhone}</th>
                <th>{t.owner.fieldWard}</th>
                <th>{t.owner.buyerOrders}</th>
                <th>{t.owner.buyerSpent}</th>
                <th>{t.owner.buyerOnlineSpent}</th>
                {canWrite ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {filteredBuyers.length === 0 ? (
                <tr>
                  <td colSpan={canWrite ? 8 : 7} className="muted">
                    {t.owner.analyticsEmpty}
                  </td>
                </tr>
              ) : (
                filteredBuyers.map((b) => {
                  const online =
                    analytics?.buyers.find((row) => row.id === b.id)
                      ?.onlineSpentBdt ?? 0;
                  const selected = selectedId === b.id;
                  return (
                    <tr
                      key={b.id}
                      className={`${b.isActive ? "" : "dim"}${selected ? " selected-row" : ""}`}
                      style={{ cursor: "pointer" }}
                      onClick={() => void loadDetail(b.id)}
                    >
                      <td data-label={t.owner.fieldShopName}>
                        {b.shopName}
                        {!b.isActive ? (
                          <div className="muted tiny">
                            {t.owner.buyerInactive}
                          </div>
                        ) : null}
                      </td>
                      <td data-label={t.owner.fieldContactName}>
                        {b.contactName ?? "—"}
                      </td>
                      <td data-label={t.owner.fieldPhone}>{b.phone}</td>
                      <td data-label={t.owner.fieldWard}>
                        {b.ward
                          ? locale === "bn" && b.ward.nameBn
                            ? b.ward.nameBn
                            : b.ward.name
                          : "—"}
                      </td>
                      <td data-label={t.owner.buyerOrders}>{b.orderCount}</td>
                      <td data-label={t.owner.buyerSpent}>
                        ৳{b.totalSpentBdt.toLocaleString()}
                      </td>
                      <td data-label={t.owner.buyerOnlineSpent}>
                        ৳{online.toLocaleString()}
                      </td>
                      {canWrite ? (
                        <td
                          className="cell-actions"
                          data-label=""
                          onClick={(e) => e.stopPropagation()}
                        >
                          {b.isActive ? (
                            <>
                              <button
                                type="button"
                                className="btn ghost compact"
                                onClick={() => startEdit(b)}
                              >
                                {t.common.edit}
                              </button>
                              <button
                                type="button"
                                className="btn ghost compact dark"
                                onClick={() => void confirmDeactivate(b)}
                              >
                                {t.owner.deactivate}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="btn ghost compact"
                              onClick={() => void reactivateBuyer(b)}
                            >
                              {t.owner.reactivate}
                            </button>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <aside className="panel-card buyer-detail">
          <div className="buyer-detail-head">
            <h2>{t.owner.buyerDetailTitle}</h2>
            {detail ? (
              <button
                type="button"
                className="linkish"
                onClick={() => {
                  setDetail(null);
                  setSelectedId(null);
                }}
              >
                {t.owner.closeBuyerDetail}
              </button>
            ) : null}
          </div>
          {detailLoading ? <p className="muted">{t.common.loading}</p> : null}
          {!detailLoading && !detail ? (
            <p className="muted tiny">{t.owner.selectBuyerHint}</p>
          ) : null}
          {detail ? (
            <>
              <p>
                <strong>{detail.buyer.shopName}</strong>
                <span className="muted tiny">
                  {" "}
                  · {detail.buyer.phone}
                  {detail.buyer.contactName
                    ? ` · ${detail.buyer.contactName}`
                    : ""}
                  {detail.buyer.isActive
                    ? ` · ${t.owner.buyerActive}`
                    : ` · ${t.owner.buyerInactive}`}
                </span>
              </p>
              <section className="stat-grid compact">
                <article>
                  <p>{t.owner.buyerOrders}</p>
                  <strong>{detail.analytics.orderCount}</strong>
                </article>
                <article>
                  <p>{t.owner.buyerSpent}</p>
                  <strong>
                    ৳{detail.analytics.totalSpentBdt.toLocaleString()}
                  </strong>
                </article>
                <article>
                  <p>{t.owner.buyerOnlineSpent}</p>
                  <strong>
                    ৳{detail.analytics.onlineSpentBdt.toLocaleString()}
                  </strong>
                </article>
                <article>
                  <p>{t.owner.buyerCounterSpent}</p>
                  <strong>
                    ৳{detail.analytics.counterSpentBdt.toLocaleString()}
                  </strong>
                </article>
              </section>
              {detail.analytics.lastOrderAt ? (
                <p className="muted tiny">
                  {t.owner.buyerLastOrder}:{" "}
                  {new Date(detail.analytics.lastOrderAt).toLocaleString()}
                </p>
              ) : null}

              <h3>{t.owner.buyerProductsBought}</h3>
              {detail.analytics.products.length === 0 ? (
                <p className="muted tiny">{t.owner.buyerNoProducts}</p>
              ) : (
                <ul className="plain-list">
                  {detail.analytics.products.map((p) => (
                    <li key={p.productId}>
                      <span>
                        {locale === "bn" && p.nameBn ? p.nameBn : p.name}
                        <div className="muted tiny">
                          {p.sku} · {p.qty} × · {p.orderCount}{" "}
                          {t.owner.buyerOrders.toLowerCase()}
                        </div>
                      </span>
                      <span>৳{p.lineTotalBdt.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}

              <h3>{t.owner.buyerRecentOrders}</h3>
              {detail.analytics.recentOrders.length === 0 ? (
                <p className="muted tiny">{t.owner.buyerNoOrders}</p>
              ) : (
                <ul className="plain-list">
                  {detail.analytics.recentOrders.map((o) => (
                    <li key={o.id}>
                      <span>
                        <Link to={`/owner/history?order=${o.id}`}>
                          {o.invoiceCode}
                        </Link>
                        <div className="muted tiny">
                          {new Date(o.orderedAt).toLocaleString()}
                          {o.source
                            ? ` · ${locale === "bn" ? o.source.nameBn : o.source.nameEn}`
                            : ""}
                          {" · "}
                          {o.lines
                            .map((l) => {
                              const name =
                                locale === "bn" && l.product?.nameBn
                                  ? l.product.nameBn
                                  : (l.product?.name ?? "");
                              return `${l.qty}× ${name}`;
                            })
                            .join(", ")}
                        </div>
                      </span>
                      <span>৳{o.totalBdt.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}
        </aside>
      </div>

    </div>
  );
}
