import { useEffect, useState, useTransition, type FormEvent } from "react";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import { api, type CashTransaction, type WalletSummary } from "../../lib/api";
import { getStoredUser } from "../../lib/session";

type Props = { locale: LocaleCode };

export function OwnerWalletPage({ locale }: Props) {
  const t = getMessages(locale);
  const user = getStoredUser();
  const canWrite =
    user?.role.code === "OWNER" || user?.role.code === "MANAGER";
  const isOwner = user?.role.code === "OWNER";

  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [txns, setTxns] = useState<CashTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [sale, setSale] = useState({ amountBdt: "", buyerName: "", note: "" });
  const [material, setMaterial] = useState({
    materialName: "",
    amountBdt: "",
    supplierName: "",
    note: "",
  });
  const [adjust, setAdjust] = useState({
    typeCode: "OPENING" as
      | "OPENING"
      | "ADJUSTMENT_IN"
      | "ADJUSTMENT_OUT"
      | "OTHER_IN"
      | "OTHER_OUT",
    amountBdt: "",
    note: "",
  });

  async function load() {
    const res = await api.owner.wallet();
    setWallet(res.wallet);
    setTxns(res.transactions);
  }

  useEffect(() => {
    startTransition(() => {
      void load().catch((err) =>
        setError(err instanceof Error ? err.message : "Failed"),
      );
    });
  }, []);

  async function onSale(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.owner.recordSale({
        amountBdt: Number(sale.amountBdt),
        buyerName: sale.buyerName || null,
        note: sale.note || null,
      });
      setSale({ amountBdt: "", buyerName: "", note: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function onMaterial(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.owner.recordMaterial({
        materialName: material.materialName,
        amountBdt: Number(material.amountBdt),
        supplierName: material.supplierName || null,
        note: material.note || null,
      });
      setMaterial({
        materialName: "",
        amountBdt: "",
        supplierName: "",
        note: "",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function onAdjust(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.owner.adjustWallet({
        typeCode: adjust.typeCode,
        amountBdt: Number(adjust.amountBdt),
        note: adjust.note || null,
      });
      setAdjust({ ...adjust, amountBdt: "", note: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="owner-page">
      <header className="owner-header">
        <div>
          <p className="eyebrow">{t.owner.navWallet}</p>
          <h1>{t.owner.walletTitle}</h1>
          <p className="muted">{t.owner.walletHint}</p>
        </div>
        <div className="wallet-balance">
          <p className="eyebrow">{t.owner.cashBalance}</p>
          <p className="wallet-amount">
            ৳{(wallet?.balanceBdt ?? 0).toLocaleString()}
          </p>
        </div>
      </header>

      {error ? <p className="error-banner">{error}</p> : null}

      {canWrite ? (
        <div className="wallet-forms">
          <form className="owner-form compact" onSubmit={onSale}>
            <h2>{t.owner.saleCredit}</h2>
            <label>
              {t.owner.fieldAmount}
              <input
                required
                type="number"
                min={0.01}
                step="0.01"
                value={sale.amountBdt}
                onChange={(e) =>
                  setSale({ ...sale, amountBdt: e.target.value })
                }
              />
            </label>
            <label>
              {t.owner.fieldBuyerName}
              <input
                value={sale.buyerName}
                onChange={(e) =>
                  setSale({ ...sale, buyerName: e.target.value })
                }
              />
            </label>
            <label className="full">
              {t.owner.fieldNote}
              <input
                value={sale.note}
                onChange={(e) => setSale({ ...sale, note: e.target.value })}
              />
            </label>
            <button type="submit" className="cta" disabled={pending}>
              {t.owner.addSale}
            </button>
          </form>

          <form className="owner-form compact" onSubmit={onMaterial}>
            <h2>{t.owner.materialDebit}</h2>
            <label>
              {t.owner.fieldMaterial}
              <input
                required
                value={material.materialName}
                onChange={(e) =>
                  setMaterial({ ...material, materialName: e.target.value })
                }
              />
            </label>
            <label>
              {t.owner.fieldAmount}
              <input
                required
                type="number"
                min={0.01}
                step="0.01"
                value={material.amountBdt}
                onChange={(e) =>
                  setMaterial({ ...material, amountBdt: e.target.value })
                }
              />
            </label>
            <label>
              {t.owner.fieldSupplier}
              <input
                value={material.supplierName}
                onChange={(e) =>
                  setMaterial({ ...material, supplierName: e.target.value })
                }
              />
            </label>
            <label className="full">
              {t.owner.fieldNote}
              <input
                value={material.note}
                onChange={(e) =>
                  setMaterial({ ...material, note: e.target.value })
                }
              />
            </label>
            <button type="submit" className="cta" disabled={pending}>
              {t.owner.addMaterial}
            </button>
          </form>

          {isOwner ? (
            <form className="owner-form compact" onSubmit={onAdjust}>
              <h2>{t.owner.adjustCash}</h2>
              <label>
                {t.owner.fieldTxnType}
                <select
                  value={adjust.typeCode}
                  onChange={(e) =>
                    setAdjust({
                      ...adjust,
                      typeCode: e.target.value as typeof adjust.typeCode,
                    })
                  }
                >
                  <option value="OPENING">{t.owner.txnOpening}</option>
                  <option value="ADJUSTMENT_IN">{t.owner.txnAdjIn}</option>
                  <option value="ADJUSTMENT_OUT">{t.owner.txnAdjOut}</option>
                  <option value="OTHER_IN">{t.owner.txnOtherIn}</option>
                  <option value="OTHER_OUT">{t.owner.txnOtherOut}</option>
                </select>
              </label>
              <label>
                {t.owner.fieldAmount}
                <input
                  required
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={adjust.amountBdt}
                  onChange={(e) =>
                    setAdjust({ ...adjust, amountBdt: e.target.value })
                  }
                />
              </label>
              <label className="full">
                {t.owner.fieldNote}
                <input
                  value={adjust.note}
                  onChange={(e) =>
                    setAdjust({ ...adjust, note: e.target.value })
                  }
                />
              </label>
              <button type="submit" className="cta" disabled={pending}>
                {t.owner.applyAdjust}
              </button>
            </form>
          ) : null}
        </div>
      ) : (
        <p className="muted">{t.owner.readOnlyHint}</p>
      )}

      <h2 className="section-title">{t.owner.ledgerTitle}</h2>
      <div className="owner-table-wrap">
        <table className="owner-table">
          <thead>
            <tr>
              <th>{t.owner.fieldDate}</th>
              <th>{t.owner.fieldTxnType}</th>
              <th>{t.owner.fieldDirection}</th>
              <th>{t.owner.fieldAmount}</th>
              <th>{t.owner.fieldBalanceAfter}</th>
              <th>{t.owner.fieldNote}</th>
            </tr>
          </thead>
          <tbody>
            {txns.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  {t.owner.ledgerEmpty}
                </td>
              </tr>
            ) : (
              txns.map((txn) => (
                <tr key={txn.id}>
                  <td>{new Date(txn.occurredAt).toLocaleString()}</td>
                  <td>
                    {locale === "bn"
                      ? (txn.type?.nameBn ?? txn.type?.code)
                      : (txn.type?.nameEn ?? txn.type?.code)}
                  </td>
                  <td
                    className={
                      txn.type?.direction === "credit"
                        ? "credit"
                        : "debit"
                    }
                  >
                    {txn.type?.direction === "credit"
                      ? t.owner.credit
                      : t.owner.debit}
                  </td>
                  <td>৳{txn.amountBdt.toLocaleString()}</td>
                  <td>৳{txn.balanceAfter.toLocaleString()}</td>
                  <td>{txn.note ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
