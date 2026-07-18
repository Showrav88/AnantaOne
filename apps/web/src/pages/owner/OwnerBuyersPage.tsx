import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
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

export function OwnerBuyersPage({ locale }: Props) {
  const t = getMessages(locale);
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
  const [deactivateBuyer, setDeactivateBuyer] = useState<BuyerRow | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function load() {
    const [b, w, a] = await Promise.all([
      api.owner.buyers(),
      api.owner.deliveryWards(),
      api.owner.buyerAnalytics(),
    ]);
    setBuyers(b.buyers);
    setWards(w.wards);
    setAnalytics({
      buyerCount: a.analytics.buyerCount,
      totalRevenueBdt: a.analytics.totalRevenueBdt,
      buyers: a.analytics.buyers.map((row) => ({
        id: row.id,
        onlineSpentBdt: row.onlineSpentBdt,
      })),
    });
  }

  useEffect(() => {
    startTransition(() => {
      void load().catch((err) =>
        setError(err instanceof Error ? err.message : "Failed"),
      );
    });
  }, []);

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
      if (editingId) {
        await api.owner.updateBuyer(editingId, body);
        setOkMsg(t.owner.buyerUpdated);
      } else {
        await api.owner.createBuyer(body);
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function confirmDeactivate() {
    if (!deactivateBuyer) return;
    setDeactivating(true);
    setError(null);
    try {
      await api.owner.updateBuyer(deactivateBuyer.id, { isActive: false });
      if (editingId === deactivateBuyer.id) resetForm();
      setDeactivateBuyer(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setDeactivating(false);
    }
  }

  return (
    <div className="owner-page">
      <header className="owner-header">
        <div>
          <p className="eyebrow">{t.owner.navBuyers}</p>
          <h1>{t.owner.buyersTitle}</h1>
          <p className="muted">{t.owner.buyersHint}</p>
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
            {buyers.map((b) => {
              const online =
                analytics?.buyers.find((row) => row.id === b.id)
                  ?.onlineSpentBdt ?? 0;
              return (
                <tr key={b.id} className={b.isActive ? "" : "dim"}>
                  <td data-label={t.owner.fieldShopName}>{b.shopName}</td>
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
                    <td className="cell-actions" data-label="">
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
                            onClick={() => setDeactivateBuyer(b)}
                          >
                            {t.owner.deactivate}
                          </button>
                        </>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {deactivateBuyer ? (
        <div
          className="owner-dialog-backdrop"
          role="presentation"
          onClick={() => (!deactivating ? setDeactivateBuyer(null) : null)}
        >
          <div
            className="owner-dialog confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="buyer-deactivate-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="buyer-deactivate-title">{t.owner.deactivateBuyerTitle}</h2>
            <p>
              {t.owner.deactivateBuyerHint.replace(
                "{name}",
                deactivateBuyer.shopName,
              )}
            </p>
            <div className="form-actions">
              <button
                type="button"
                className="btn primary"
                disabled={deactivating}
                onClick={() => void confirmDeactivate()}
              >
                {t.owner.confirmDeactivateBuyer}
              </button>
              <button
                type="button"
                className="btn ghost"
                disabled={deactivating}
                onClick={() => setDeactivateBuyer(null)}
              >
                {t.common.cancel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
