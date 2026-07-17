import { useEffect, useState, useTransition, type FormEvent } from "react";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import {
  api,
  type SalaryPaymentRow,
  type StaffMember,
} from "../../lib/api";
import { getStoredUser } from "../../lib/session";

type Props = { locale: LocaleCode };

export function OwnerPaymentsPage({ locale }: Props) {
  const t = getMessages(locale);
  const user = getStoredUser();
  const isOwner = user?.role.code === "OWNER";
  const canView =
    user?.role.code === "OWNER" || user?.role.code === "MANAGER";

  const [payments, setPayments] = useState<SalaryPaymentRow[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [form, setForm] = useState({
    userId: "",
    amountBdt: "",
    periodLabel: "",
    note: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function load() {
    const [payRes, staffRes] = await Promise.all([
      api.owner.payments(),
      api.owner.staff(),
    ]);
    setPayments(payRes.payments);
    const payees = staffRes.staff.filter(
      (s) => s.isActive && (s.role.code === "MANAGER" || s.role.code === "EMPLOYEE"),
    );
    setStaff(payees);
    if (!form.userId && payees[0]) {
      setForm((f) => ({
        ...f,
        userId: payees[0]!.id,
        amountBdt:
          payees[0]!.salaryBdt != null ? String(payees[0]!.salaryBdt) : "",
      }));
    }
  }

  useEffect(() => {
    if (!canView) return;
    startTransition(() => {
      void load().catch((err) =>
        setError(err instanceof Error ? err.message : "Failed"),
      );
    });
  }, [canView]);

  function onStaffChange(userId: string) {
    const s = staff.find((x) => x.id === userId);
    setForm({
      ...form,
      userId,
      amountBdt: s?.salaryBdt != null ? String(s.salaryBdt) : form.amountBdt,
    });
  }

  async function onPay(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.owner.paySalary({
        userId: form.userId,
        amountBdt: form.amountBdt === "" ? undefined : Number(form.amountBdt),
        periodLabel: form.periodLabel || null,
        note: form.note || null,
      });
      setForm({ ...form, amountBdt: "", periodLabel: "", note: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  if (!canView) {
    return (
      <div className="owner-page">
        <p className="muted">{t.owner.staffDenied}</p>
      </div>
    );
  }

  return (
    <div className="owner-page">
      <header className="owner-header">
        <div>
          <p className="eyebrow">{t.owner.navPayments}</p>
          <h1>{t.owner.paymentsTitle}</h1>
          <p className="muted">{t.owner.paymentsHint}</p>
        </div>
      </header>

      {error ? <p className="error-banner">{error}</p> : null}

      {isOwner ? (
        <form className="owner-form compact" onSubmit={onPay}>
          <label>
            {t.owner.fieldStaff}
            <select
              required
              value={form.userId}
              onChange={(e) => onStaffChange(e.target.value)}
            >
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.role.code})
                  {s.salaryBdt != null
                    ? ` — ৳${s.salaryBdt.toLocaleString()}`
                    : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.owner.fieldAmount}
            <input
              type="number"
              min={0.01}
              step="0.01"
              value={form.amountBdt}
              onChange={(e) => setForm({ ...form, amountBdt: e.target.value })}
            />
          </label>
          <label>
            {t.owner.fieldPeriod}
            <input
              placeholder="2026-07"
              value={form.periodLabel}
              onChange={(e) =>
                setForm({ ...form, periodLabel: e.target.value })
              }
            />
          </label>
          <label className="full">
            {t.owner.fieldNote}
            <input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </label>
          <button type="submit" className="cta" disabled={pending || !form.userId}>
            {t.owner.paySalary}
          </button>
        </form>
      ) : (
        <p className="muted">{t.owner.paymentsOwnerOnly}</p>
      )}

      <div className="owner-table-wrap">
        <table className="owner-table">
          <thead>
            <tr>
              <th>{t.owner.fieldDate}</th>
              <th>{t.owner.fieldStaff}</th>
              <th>{t.owner.fieldPeriod}</th>
              <th>{t.owner.fieldAmount}</th>
              <th>{t.owner.fieldNote}</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  {t.owner.paymentsEmpty}
                </td>
              </tr>
            ) : (
              payments.map((p) => (
                <tr key={p.id}>
                  <td>{new Date(p.paidAt).toLocaleString()}</td>
                  <td>
                    {p.staff.name}
                    <div className="muted tiny">{p.staff.role}</div>
                  </td>
                  <td>{p.periodLabel ?? "—"}</td>
                  <td>৳{p.amountBdt.toLocaleString()}</td>
                  <td>{p.note ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
