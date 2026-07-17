import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import {
  api,
  type CashTransaction,
  type SupplyPurchase,
  type WalletAnalytics,
  type WalletSummary,
} from "../../lib/api";
import { getStoredUser } from "../../lib/session";

type Props = { locale: LocaleCode };

type ExpenseCategory = {
  code: string;
  nameEn: string;
  nameBn: string;
  description: string | null;
};

type SupplyKind = {
  code: string;
  nameEn: string;
  nameBn: string;
  description: string | null;
};

type UnitOpt = { code: string; nameEn: string; nameBn: string };

type Tab = "record" | "ledger" | "analytics";
type RecordPanel = "supply" | "expense" | "adjust" | null;
type AnalyticsPanel =
  | "summary"
  | "kinds"
  | "expenses"
  | "purchases"
  | "txns"
  | null;

function CollapsePanel({
  id,
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className={`collapse-panel${open ? " open" : ""}`}>
      <button
        type="button"
        className="collapse-head"
        aria-expanded={open}
        aria-controls={`panel-${id}`}
        onClick={onToggle}
      >
        <span className="collapse-titles">
          <strong>{title}</strong>
          {!open && summary ? (
            <span className="muted tiny">{summary}</span>
          ) : null}
        </span>
        <span className="collapse-chevron" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? (
        <div className="collapse-body" id={`panel-${id}`}>
          {children}
        </div>
      ) : null}
    </section>
  );
}

export function OwnerWalletPage({ locale }: Props) {
  const t = getMessages(locale);
  const user = getStoredUser();
  const canWrite =
    user?.role.code === "OWNER" || user?.role.code === "MANAGER";
  const isOwner = user?.role.code === "OWNER";

  const [tab, setTab] = useState<Tab>("record");
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [txns, setTxns] = useState<CashTransaction[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [kinds, setKinds] = useState<SupplyKind[]>([]);
  const [units, setUnits] = useState<UnitOpt[]>([]);
  const [analytics, setAnalytics] = useState<WalletAnalytics | null>(null);
  const [expandedTxn, setExpandedTxn] = useState<string | null>(null);
  const [openRecord, setOpenRecord] = useState<RecordPanel>(null);
  const [openAnalytics, setOpenAnalytics] =
    useState<AnalyticsPanel>("summary");
  const [tripOpen, setTripOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [material, setMaterial] = useState({
    materialName: "",
    kindCode: "RAW_MATERIAL",
    unitCode: "LITER",
    qty: "1",
    goodsAmountBdt: "",
    transportBdt: "0",
    driverBdt: "0",
    travelBdt: "0",
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

  const materialTotal = useMemo(() => {
    const goods = Number(material.goodsAmountBdt || 0);
    const transport = Number(material.transportBdt || 0);
    const driver = Number(material.driverBdt || 0);
    const travel = Number(material.travelBdt || 0);
    return goods + transport + driver + travel;
  }, [material]);

  const landedHint = useMemo(() => {
    const qty = Number(material.qty || 0);
    if (!(qty > 0) || !(materialTotal > 0)) return null;
    return materialTotal / qty;
  }, [material.qty, materialTotal]);

  async function load() {
    const [walletRes, catRes, metaRes] = await Promise.all([
      api.owner.wallet(),
      api.owner
        .expenseCategories()
        .catch(() => ({ categories: [] as ExpenseCategory[] })),
      api.owner.supplyMeta().catch(() => ({
        kinds: [] as SupplyKind[],
        units: [] as UnitOpt[],
      })),
    ]);
    setWallet(walletRes.wallet);
    setTxns(walletRes.transactions);
    setCategories(catRes.categories);
    setKinds(metaRes.kinds);
    setUnits(metaRes.units);
    if (metaRes.kinds[0]) {
      setMaterial((m) =>
        metaRes.kinds.some((k) => k.code === m.kindCode)
          ? m
          : { ...m, kindCode: metaRes.kinds[0]!.code },
      );
    }
  }

  async function loadAnalytics() {
    const res = await api.owner.walletAnalytics(90);
    setAnalytics(res);
  }

  useEffect(() => {
    startTransition(() => {
      void load().catch((err) =>
        setError(err instanceof Error ? err.message : "Failed"),
      );
    });
  }, []);

  useEffect(() => {
    if (tab !== "analytics") return;
    startTransition(() => {
      void loadAnalytics().catch((err) =>
        setError(err instanceof Error ? err.message : "Failed"),
      );
    });
  }, [tab]);

  async function onMaterial(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);
    try {
      await api.owner.recordMaterial({
        materialName: material.materialName,
        kindCode: material.kindCode,
        unitCode: material.unitCode,
        qty: Number(material.qty),
        goodsAmountBdt: Number(material.goodsAmountBdt || 0),
        transportBdt: Number(material.transportBdt || 0),
        driverBdt: Number(material.driverBdt || 0),
        travelBdt: Number(material.travelBdt || 0),
        supplierName: material.supplierName || null,
        supplierPhone: material.supplierPhone || null,
        note: material.note || null,
      });
      setMaterial({
        materialName: "",
        kindCode: material.kindCode,
        unitCode: material.unitCode,
        qty: "1",
        goodsAmountBdt: "",
        transportBdt: "0",
        driverBdt: "0",
        travelBdt: "0",
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

  function labelKind(k: { nameEn: string; nameBn: string }) {
    return locale === "bn" ? k.nameBn : k.nameEn;
  }

  function renderPurchaseBreakdown(p: SupplyPurchase) {
    return (
      <div className="cost-breakdown">
        <p>
          <strong>{p.materialName}</strong>
          <span className="muted tiny">
            {" "}
            · {p.qty}{" "}
            {p.unit
              ? locale === "bn"
                ? p.unit.nameBn
                : p.unit.nameEn
              : ""}
            {p.kind
              ? ` · ${locale === "bn" ? p.kind.nameBn : p.kind.nameEn}`
              : ""}
          </span>
        </p>
        <ul className="breakdown-list">
          <li>
            {t.owner.costGoods}: ৳{p.goodsAmountBdt.toLocaleString()}
          </li>
          <li>
            {t.owner.costTransport}: ৳{p.transportBdt.toLocaleString()}
          </li>
          <li>
            {t.owner.costDriver}: ৳{p.driverBdt.toLocaleString()}
          </li>
          <li>
            {t.owner.costTravel}: ৳{p.travelBdt.toLocaleString()}
          </li>
          <li className="total">
            {t.owner.costTotal}: ৳{p.amountBdt.toLocaleString()}
          </li>
          {p.landedUnitCostBdt != null ? (
            <li className="landed">
              {t.owner.landedUnitCost}: ৳
              {p.landedUnitCostBdt.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}
              /{p.unit?.code ?? "u"}
            </li>
          ) : null}
        </ul>
        {p.supplierName || p.supplierPhone ? (
          <p className="muted tiny">
            {p.supplierName}
            {p.supplierPhone ? ` · ${p.supplierPhone}` : ""}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="owner-page">
      <header className="owner-header">
        <div>
          <p className="eyebrow">{t.owner.navWallet}</p>
          <h1>{t.owner.walletTitle}</h1>
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

      <div className="wallet-tabs" role="tablist">
        {(
          [
            ["record", t.owner.walletTabRecord],
            ["ledger", t.owner.walletTabLedger],
            ["analytics", t.owner.walletTabAnalytics],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "wallet-tab active" : "wallet-tab"}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? <p className="error-banner">{error}</p> : null}
      {okMsg ? <p className="ok-banner">{okMsg}</p> : null}

      {tab === "record" ? (
        canWrite ? (
          <div className="wallet-accordion">
            <CollapsePanel
              id="supply"
              title={t.owner.materialDebit}
              summary={t.owner.collapseSupplyHint}
              open={openRecord === "supply"}
              onToggle={() =>
                setOpenRecord((v) => (v === "supply" ? null : "supply"))
              }
            >
              <form className="owner-form compact" onSubmit={onMaterial}>
                <p className="muted tiny full">{t.owner.materialDebitHint}</p>
                <label>
                  {t.owner.fieldMaterial}
                  <input
                    required
                    value={material.materialName}
                    onChange={(e) =>
                      setMaterial({ ...material, materialName: e.target.value })
                    }
                    placeholder={t.owner.supplyNameHint}
                  />
                </label>
                <label>
                  {t.owner.fieldSupplyKind}
                  <select
                    value={material.kindCode}
                    onChange={(e) =>
                      setMaterial({ ...material, kindCode: e.target.value })
                    }
                  >
                    {(kinds.length
                      ? kinds
                      : [
                          { code: "RAW_MATERIAL", nameEn: "Raw", nameBn: "কাঁচা" },
                          { code: "BOTTLE", nameEn: "Bottle", nameBn: "বোতল" },
                          { code: "ACID", nameEn: "Acid", nameBn: "অ্যাসিড" },
                        ]
                    ).map((k) => (
                      <option key={k.code} value={k.code}>
                        {labelKind(k)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t.owner.fieldQty}
                  <input
                    required
                    type="number"
                    min={0.001}
                    step="any"
                    value={material.qty}
                    onChange={(e) =>
                      setMaterial({ ...material, qty: e.target.value })
                    }
                  />
                </label>
                <label>
                  {t.owner.fieldUnit}
                  <select
                    value={material.unitCode}
                    onChange={(e) =>
                      setMaterial({ ...material, unitCode: e.target.value })
                    }
                  >
                    {(units.length
                      ? units
                      : [
                          { code: "LITER", nameEn: "Liter", nameBn: "লিটার" },
                          { code: "BOTTLE", nameEn: "Bottle", nameBn: "বোতল" },
                          { code: "PIECE", nameEn: "Piece", nameBn: "পিস" },
                          { code: "KG", nameEn: "Kg", nameBn: "কেজি" },
                        ]
                    ).map((u) => (
                      <option key={u.code} value={u.code}>
                        {locale === "bn" ? u.nameBn : u.nameEn} ({u.code})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t.owner.costGoods}
                  <input
                    required
                    type="number"
                    min={0}
                    step="0.01"
                    value={material.goodsAmountBdt}
                    onChange={(e) =>
                      setMaterial({
                        ...material,
                        goodsAmountBdt: e.target.value,
                      })
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
                      setMaterial({
                        ...material,
                        supplierPhone: e.target.value,
                      })
                    }
                    placeholder="01XXXXXXXXX"
                  />
                </label>

                <div className="nested-collapse full">
                  <button
                    type="button"
                    className="collapse-head nested"
                    aria-expanded={tripOpen}
                    onClick={() => setTripOpen((v) => !v)}
                  >
                    <span>
                      <strong>{t.owner.tripCosts}</strong>
                      <span className="muted tiny">
                        {" "}
                        · ৳
                        {(
                          Number(material.transportBdt || 0) +
                          Number(material.driverBdt || 0) +
                          Number(material.travelBdt || 0)
                        ).toLocaleString()}
                      </span>
                    </span>
                    <span aria-hidden>{tripOpen ? "▾" : "▸"}</span>
                  </button>
                  {tripOpen ? (
                    <div className="owner-form compact nested-body">
                      <label>
                        {t.owner.costTransport}
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={material.transportBdt}
                          onChange={(e) =>
                            setMaterial({
                              ...material,
                              transportBdt: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        {t.owner.costDriver}
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={material.driverBdt}
                          onChange={(e) =>
                            setMaterial({
                              ...material,
                              driverBdt: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        {t.owner.costTravel}
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={material.travelBdt}
                          onChange={(e) =>
                            setMaterial({
                              ...material,
                              travelBdt: e.target.value,
                            })
                          }
                        />
                      </label>
                    </div>
                  ) : null}
                </div>

                <label className="full">
                  {t.owner.fieldNote}
                  <input
                    value={material.note}
                    onChange={(e) =>
                      setMaterial({ ...material, note: e.target.value })
                    }
                  />
                </label>
                <p className="muted tiny full">
                  {t.owner.costTotal}: ৳{materialTotal.toLocaleString()}
                  {landedHint != null
                    ? ` · ${t.owner.landedUnitCost}: ৳${landedHint.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                    : ""}
                </p>
                <button
                  type="submit"
                  className="cta"
                  disabled={pending || !(materialTotal > 0)}
                >
                  {t.owner.addMaterial}
                </button>
              </form>
            </CollapsePanel>

            <CollapsePanel
              id="expense"
              title={t.owner.expenseDebit}
              summary={t.owner.collapseExpenseHint}
              open={openRecord === "expense"}
              onToggle={() =>
                setOpenRecord((v) => (v === "expense" ? null : "expense"))
              }
            >
              <form className="owner-form compact" onSubmit={onExpense}>
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
                          {
                            code: "UTILITY",
                            nameEn: "Utility",
                            nameBn: "ইউটিলিটি",
                          },
                          {
                            code: "TRANSPORT",
                            nameEn: "Transport",
                            nameBn: "পরিবহন",
                          },
                          {
                            code: "DRIVER",
                            nameEn: "Driver",
                            nameBn: "ড্রাইভার",
                          },
                          {
                            code: "TRAVEL",
                            nameEn: "Travel",
                            nameBn: "ভ্রমণ",
                          },
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
            </CollapsePanel>

            {isOwner ? (
              <CollapsePanel
                id="adjust"
                title={t.owner.adjustCash}
                summary={t.owner.collapseAdjustHint}
                open={openRecord === "adjust"}
                onToggle={() =>
                  setOpenRecord((v) => (v === "adjust" ? null : "adjust"))
                }
              >
                <form className="owner-form compact" onSubmit={onAdjust}>
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
                      <option value="ADJUSTMENT_OUT">
                        {t.owner.txnAdjOut}
                      </option>
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
              </CollapsePanel>
            ) : null}
          </div>
        ) : (
          <p className="muted">{t.owner.readOnlyHint}</p>
        )
      ) : null}

      {tab === "ledger" ? (
        <>
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
        </>
      ) : null}

      {tab === "analytics" && analytics ? (
        <div className="wallet-analytics wallet-accordion">
          <p className="muted tiny">
            {t.owner.analyticsHint} ({analytics.days} {t.owner.days})
          </p>

          <CollapsePanel
            id="summary"
            title={t.owner.analyticsSummary}
            summary={`৳${analytics.totals.netCashFlowBdt.toLocaleString()} ${t.owner.statNetFlow}`}
            open={openAnalytics === "summary"}
            onToggle={() =>
              setOpenAnalytics((v) => (v === "summary" ? null : "summary"))
            }
          >
            <div className="stat-grid analytics-stats">
              <article>
                <p>{t.owner.statSalesIn}</p>
                <strong className="credit">
                  ৳{analytics.totals.salesCreditBdt.toLocaleString()}
                </strong>
              </article>
              <article>
                <p>{t.owner.statMaterialOut}</p>
                <strong className="debit">
                  ৳{analytics.totals.materialTotalBdt.toLocaleString()}
                </strong>
              </article>
              <article>
                <p>{t.owner.costGoods}</p>
                <strong>
                  ৳{analytics.totals.materialGoodsBdt.toLocaleString()}
                </strong>
              </article>
              <article>
                <p>{t.owner.costTransport}</p>
                <strong>
                  ৳
                  {(
                    analytics.totals.materialTransportBdt +
                    analytics.totals.standaloneTransportBdt
                  ).toLocaleString()}
                </strong>
              </article>
              <article>
                <p>{t.owner.costDriver}</p>
                <strong>
                  ৳{analytics.totals.materialDriverBdt.toLocaleString()}
                </strong>
              </article>
              <article>
                <p>{t.owner.costTravel}</p>
                <strong>
                  ৳{analytics.totals.materialTravelBdt.toLocaleString()}
                </strong>
              </article>
              <article>
                <p>{t.owner.statUtility}</p>
                <strong>
                  ৳{analytics.totals.utilityBdt.toLocaleString()}
                </strong>
              </article>
              <article>
                <p>{t.owner.statNetFlow}</p>
                <strong
                  className={
                    analytics.totals.netCashFlowBdt >= 0 ? "credit" : "debit"
                  }
                >
                  ৳{analytics.totals.netCashFlowBdt.toLocaleString()}
                </strong>
              </article>
            </div>
          </CollapsePanel>

          <CollapsePanel
            id="kinds"
            title={t.owner.bySupplyKind}
            summary={`${analytics.bySupplyKind.length}`}
            open={openAnalytics === "kinds"}
            onToggle={() =>
              setOpenAnalytics((v) => (v === "kinds" ? null : "kinds"))
            }
          >
            <ul className="plain-list">
              {analytics.bySupplyKind.length === 0 ? (
                <li className="muted">{t.owner.analyticsEmpty}</li>
              ) : (
                analytics.bySupplyKind.map((k) => (
                  <li key={k.code}>
                    <span>
                      {locale === "bn" ? k.nameBn : k.nameEn}
                      <div className="muted tiny">
                        {t.owner.fieldQty}: {k.qty}
                      </div>
                    </span>
                    <span>৳{k.totalBdt.toLocaleString()}</span>
                  </li>
                ))
              )}
            </ul>
          </CollapsePanel>

          <CollapsePanel
            id="expenses"
            title={t.owner.byExpenseCategory}
            summary={`${analytics.byExpenseCategory.length}`}
            open={openAnalytics === "expenses"}
            onToggle={() =>
              setOpenAnalytics((v) => (v === "expenses" ? null : "expenses"))
            }
          >
            <ul className="plain-list">
              {analytics.byExpenseCategory.length === 0 ? (
                <li className="muted">{t.owner.analyticsEmpty}</li>
              ) : (
                analytics.byExpenseCategory.map((c) => (
                  <li key={c.code}>
                    <span>
                      {locale === "bn" ? c.nameBn : c.nameEn}
                      <div className="muted tiny">{c.count}×</div>
                    </span>
                    <span>৳{c.totalBdt.toLocaleString()}</span>
                  </li>
                ))
              )}
            </ul>
          </CollapsePanel>

          <CollapsePanel
            id="purchases"
            title={t.owner.supplyPurchases}
            summary={`${analytics.purchases.length}`}
            open={openAnalytics === "purchases"}
            onToggle={() =>
              setOpenAnalytics((v) =>
                v === "purchases" ? null : "purchases",
              )
            }
          >
            <p className="muted tiny">{t.owner.landedCostHint}</p>
            <div className="purchase-cards">
              {analytics.purchases.length === 0 ? (
                <p className="muted">{t.owner.analyticsEmpty}</p>
              ) : (
                analytics.purchases.map((p) => (
                  <article key={p.id} className="panel-card">
                    <p className="muted tiny">
                      {new Date(p.purchasedAt).toLocaleString()}
                    </p>
                    {renderPurchaseBreakdown(p)}
                  </article>
                ))
              )}
            </div>
          </CollapsePanel>

          <CollapsePanel
            id="txns"
            title={t.owner.txnBreakdown}
            summary={`${analytics.transactions.length}`}
            open={openAnalytics === "txns"}
            onToggle={() =>
              setOpenAnalytics((v) => (v === "txns" ? null : "txns"))
            }
          >
            <ul className="txn-breakdown-list">
              {analytics.transactions.map((txn) => {
                const open = expandedTxn === txn.id;
                const detail = txn.detail as SupplyPurchase | null;
                return (
                  <li key={txn.id}>
                    <button
                      type="button"
                      className="history-item"
                      onClick={() =>
                        setExpandedTxn(open ? null : txn.id)
                      }
                    >
                      <span>
                        {locale === "bn"
                          ? (txn.type?.nameBn ?? txn.type?.code)
                          : (txn.type?.nameEn ?? txn.type?.code)}
                        <div className="muted tiny">
                          {new Date(txn.occurredAt).toLocaleString()}
                          {txn.detailType === "material"
                            ? ` · ${t.owner.tapForBreakdown}`
                            : ""}
                        </div>
                      </span>
                      <span
                        className={
                          txn.type?.direction === "credit"
                            ? "credit"
                            : "debit"
                        }
                      >
                        ৳{txn.amountBdt.toLocaleString()}
                      </span>
                    </button>
                    {open && txn.detailType === "material" && detail ? (
                      <div className="txn-detail panel-card">
                        {renderPurchaseBreakdown(detail)}
                      </div>
                    ) : null}
                    {open && txn.detailType === "expense" && txn.detail ? (
                      <div className="txn-detail panel-card">
                        {(() => {
                          const d = txn.detail as {
                            title: string;
                            amountBdt: number;
                            contactName?: string | null;
                            contactPhone?: string | null;
                            category?: {
                              code: string;
                              nameEn: string;
                              nameBn: string;
                            };
                          };
                          return (
                            <>
                              <p>
                                <strong>{d.title}</strong>
                                {d.category ? (
                                  <span className="muted tiny">
                                    {" "}
                                    ·{" "}
                                    {locale === "bn"
                                      ? d.category.nameBn
                                      : d.category.nameEn}
                                  </span>
                                ) : null}
                              </p>
                              <p className="muted tiny">
                                ৳{d.amountBdt.toLocaleString()}
                                {d.contactName || d.contactPhone
                                  ? ` · ${[d.contactName, d.contactPhone].filter(Boolean).join(" · ")}`
                                  : ""}
                              </p>
                            </>
                          );
                        })()}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </CollapsePanel>
        </div>
      ) : null}

      {tab === "analytics" && !analytics ? (
        <p className="muted">{pending ? "…" : t.owner.analyticsEmpty}</p>
      ) : null}
    </div>
  );
}
