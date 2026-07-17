import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import { api, type CashTransaction, type WalletSummary } from "../../lib/api";
import { getStoredUser } from "../../lib/session";

type Props = { locale: LocaleCode };

type ExpenseCategory = {
  code: string;
  nameEn: string;
  nameBn: string;
  description: string | null;
};

export function OwnerWalletPage({ locale }: Props) {
  const t = getMessages(locale);
  const user = getStoredUser();
  const canWrite =
    user?.role.code === "OWNER" || user?.role.code === "MANAGER";
  const isOwner = user?.role.code === "OWNER";

  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [txns, setTxns] = useState<CashTransaction[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [material, setMaterial] = useState({
    materialName: "",
    amountBdt: "",
    supplierName: "",
    supplierPhone: "",
    note: "",
  });
  const [expense, setExpense] = useState({
    categoryCode: "UTILITY",
    title: "",
    amountBdt: "",
    contactName: "",
    contactPhone: "",
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
    const [walletRes, catRes] = await Promise.all([
      api.owner.wallet(),
      api.owner.expenseCategories().catch(() => ({ categories: [] as ExpenseCategory[] })),
    ]);
    setWallet(walletRes.wallet);
    setTxns(walletRes.transactions);
    setCategories(catRes.categories);
    if (catRes.categories[0] && !expense.categoryCode) {
      setExpense((e) => ({ ...e, categoryCode: catRes.categories[0]!.code }));
    }
  }

  useEffect(() => {
    startTransition(() => {
      void load().catch((err) =>
        setError(err instanceof Error ? err.message : "Failed"),
      );
    });
  }, []);

  async function onMaterial(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);
    try {
      await api.owner.recordMaterial({
        materialName: material.materialName,
        amountBdt: Number(material.amountBdt),
        supplierName: material.supplierName || null,
        supplierPhone: material.supplierPhone || null,
        note: material.note || null,
      });
      setMaterial({
        materialName: "",
        amountBdt: "",
        supplierName: "",
        supplierPhone: "",
        note: "",
      });
      setOkMsg(t.owner.expenseDebited);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function onExpense(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);
    try {
      await api.owner.recordExpense({
        categoryCode: expense.categoryCode,
        title: expense.title,
        amountBdt: Number(expense.amountBdt),
        contactName: expense.contactName || null,
        contactPhone: expense.contactPhone || null,
        note: expense.note || null,
      });
      setExpense({
        categoryCode: expense.categoryCode,
        title: "",
        amountBdt: "",
        contactName: "",
        contactPhone: "",
        note: "",
      });
      setOkMsg(t.owner.expenseDebited);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function onAdjust(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);
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
          <p className="muted tiny">
            {t.owner.walletSaleNote}{" "}
            <Link to="/owner/sell">{t.owner.navSell}</Link>
          </p>
        </div>
        <div className="wallet-balance">
          <p className="eyebrow">{t.owner.cashBalance}</p>
          <p className="wallet-amount">
            ৳{(wallet?.balanceBdt ?? 0).toLocaleString()}
          </p>
        </div>
      </header>

      {error ? <p className="error-banner">{error}</p> : null}
      {okMsg ? <p className="ok-banner">{okMsg}</p> : null}

      {canWrite ? (
        <div className="wallet-forms">
          <form className="owner-form compact" onSubmit={onMaterial}>
            <h2>{t.owner.materialDebit}</h2>
            <p className="muted tiny full">{t.owner.materialDebitHint}</p>
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
            <label>
              {t.owner.fieldSupplierPhone}
              <input
                type="tel"
                inputMode="tel"
                value={material.supplierPhone}
                onChange={(e) =>
                  setMaterial({ ...material, supplierPhone: e.target.value })
                }
                placeholder="01XXXXXXXXX"
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

          <form className="owner-form compact" onSubmit={onExpense}>
            <h2>{t.owner.expenseDebit}</h2>
            <p className="muted tiny full">{t.owner.expenseDebitHint}</p>
            <label>
              {t.owner.fieldExpenseCategory}
              <select
                value={expense.categoryCode}
                onChange={(e) =>
                  setExpense({ ...expense, categoryCode: e.target.value })
                }
              >
                {(categories.length
                  ? categories
                  : [
                      { code: "UTILITY", nameEn: "Utility", nameBn: "ইউটিলিটি" },
                      { code: "FAMILY", nameEn: "Family", nameBn: "পারিবারিক" },
                      { code: "LAWSUIT", nameEn: "Lawsuit", nameBn: "মামলা" },
                      { code: "GESTURE", nameEn: "Gesture", nameBn: "সৌজন্য" },
                      { code: "OTHER", nameEn: "Other", nameBn: "অন্যান্য" },
                    ]
                ).map((c) => (
                  <option key={c.code} value={c.code}>
                    {locale === "bn" ? c.nameBn : c.nameEn}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t.owner.fieldExpenseTitle}
              <input
                required
                value={expense.title}
                onChange={(e) =>
                  setExpense({ ...expense, title: e.target.value })
                }
                placeholder={t.owner.expenseTitleHint}
              />
            </label>
            <label>
              {t.owner.fieldAmount}
              <input
                required
                type="number"
                min={0.01}
                step="0.01"
                value={expense.amountBdt}
                onChange={(e) =>
                  setExpense({ ...expense, amountBdt: e.target.value })
                }
              />
            </label>
            <label>
              {t.owner.fieldContactName}
              <input
                value={expense.contactName}
                onChange={(e) =>
                  setExpense({ ...expense, contactName: e.target.value })
                }
              />
            </label>
            <label>
              {t.owner.fieldContactPhone}
              <input
                type="tel"
                inputMode="tel"
                value={expense.contactPhone}
                onChange={(e) =>
                  setExpense({ ...expense, contactPhone: e.target.value })
                }
                placeholder="01XXXXXXXXX"
              />
            </label>
            <label className="full">
              {t.owner.fieldNote}
              <input
                value={expense.note}
                onChange={(e) =>
                  setExpense({ ...expense, note: e.target.value })
                }
              />
            </label>
            <button type="submit" className="cta" disabled={pending}>
              {t.owner.addExpense}
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
