import { useEffect, useState, useTransition, type FormEvent } from "react";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import {
  confirmDetails,
  useConfirmAction,
} from "../../components/ConfirmActionDialog";
import {
  api,
  type SalaryPaymentRow,
  type StaffMember,
} from "../../lib/api";
import { getStoredUser } from "../../lib/session";

type Props = { locale: LocaleCode };

function toDateTimeLocalValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromDateTimeLocalValue(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

export function OwnerPaymentsPage({ locale }: Props) {
  const t = getMessages(locale);
  const { confirm } = useConfirmAction();
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
    paidAt: "",
    note: "",
  });
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function load() {
    const [payRes, staffRes] = await Promise.all([
      api.owner.payments(),
      api.owner.staff(),
    ]);
    setPayments(payRes.payments);
    const payees = staffRes.staff.filter(
      (s) =>
        s.isActive &&
        (s.role.code === "MANAGER" || s.role.code === "EMPLOYEE"),
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

  function staffLabel(userId: string) {
    const member = staff.find((s) => s.id === userId);
    return member ? `${member.name} (${member.role.code})` : userId;
  }

  function startEditPayment(payment: SalaryPaymentRow) {
    if (payment.isReversed) return;
    setEditingPaymentId(payment.id);
    setForm({
      userId: payment.staff.id,
      amountBdt: String(payment.amountBdt),
      periodLabel: payment.periodLabel ?? "",
      paidAt: toDateTimeLocalValue(payment.paidAt),
      note: payment.note ?? "",
    });
    setError(null);
    setOkMsg(null);
  }

  function cancelEditPayment() {
    setEditingPaymentId(null);
    const selected = staff.find((s) => s.id === form.userId) ?? staff[0];
    setForm({
      userId: selected?.id ?? "",
      amountBdt: selected?.salaryBdt != null ? String(selected.salaryBdt) : "",
      periodLabel: "",
      paidAt: "",
      note: "",
    });
  }

  async function onPay(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);
    const amount = form.amountBdt === "" ? undefined : Number(form.amountBdt);
    if (editingPaymentId && amount == null) {
      setError(t.owner.fieldAmount);
      return;
    }
    const decision = await confirm({
      title: editingPaymentId
        ? t.common.confirmUpdateTitle
        : t.common.confirmCreateTitle,
      message: editingPaymentId
        ? t.common.confirmUpdateMessage
        : t.common.confirmCreateMessage,
      tone: editingPaymentId ? "update" : "create",
      confirmLabel: editingPaymentId
        ? t.common.confirmUpdate
        : t.common.confirmCreate,
      cancelLabel: t.common.cancel,
      details: confirmDetails(
        [
          ...(editingPaymentId
            ? [{ label: t.common.fieldId, value: editingPaymentId }]
            : []),
          { label: t.owner.fieldStaff, value: staffLabel(form.userId) },
          {
            label: t.owner.fieldAmount,
            value: amount == null ? t.common.autoAssigned : `৳${amount.toLocaleString()}`,
          },
          { label: t.owner.fieldPeriod, value: form.periodLabel },
          { label: t.owner.fieldDate, value: form.paidAt },
          { label: t.owner.fieldNote, value: form.note },
        ],
        { skipEmpty: true },
      ),
    });
    if (!decision.ok) return;

    try {
      const paidAt = fromDateTimeLocalValue(form.paidAt);
      if (editingPaymentId) {
        await api.owner.updateSalary(editingPaymentId, {
          amountBdt: amount!,
          periodLabel: form.periodLabel || null,
          note: form.note || null,
          ...(paidAt ? { paidAt } : {}),
        });
        setEditingPaymentId(null);
        setOkMsg(t.owner.salaryUpdated);
      } else {
        await api.owner.paySalary({
          userId: form.userId,
          amountBdt: amount,
          periodLabel: form.periodLabel || null,
          note: form.note || null,
          ...(paidAt ? { paidAt } : {}),
        });
        setOkMsg(t.owner.paySalaryDone);
      }
      setForm({ ...form, amountBdt: "", periodLabel: "", paidAt: "", note: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function onReverse(payment: SalaryPaymentRow) {
    setError(null);
    setOkMsg(null);
    const decision = await confirm({
      title: t.common.confirmDeleteTitle,
      message: t.owner.salaryReverseFormHint,
      tone: "danger",
      confirmLabel: t.owner.confirmSalaryReverse,
      cancelLabel: t.common.cancel,
      details: confirmDetails(
        [
          { label: t.common.fieldId, value: payment.id },
          { label: t.owner.fieldStaff, value: `${payment.staff.name} (${payment.staff.role})` },
          { label: t.owner.fieldAmount, value: `৳${payment.amountBdt.toLocaleString()}` },
          { label: t.owner.fieldPeriod, value: payment.periodLabel },
          { label: t.owner.fieldNote, value: payment.note },
        ],
        { skipEmpty: true },
      ),
      reasonLabel: t.owner.reverseReason,
      reasonPlaceholder: t.owner.salaryReverseReasonHint,
      reasonMinLength: 5,
    });
    if (!decision.ok) return;

    try {
      const res = await api.owner.reverseSalary(payment.id, decision.reason ?? "");
      setOkMsg(
        `${t.owner.salaryReverseDone} · ${t.owner.cashCredited}: ৳${(res.cashCreditedBdt ?? res.payment.amountBdt).toLocaleString()}`,
      );
      if (editingPaymentId === payment.id) {
        cancelEditPayment();
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reverse failed");
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
          <p className="muted tiny">{t.owner.salaryReverseHint}</p>
        </div>
      </header>

      {error ? <p className="error-banner">{error}</p> : null}
      {okMsg ? <p className="ok-banner">{okMsg}</p> : null}

      {isOwner ? (
        <form className="owner-form compact" onSubmit={onPay}>
          {editingPaymentId ? (
            <p className="ok-banner tiny full">{t.owner.editSalary}</p>
          ) : null}
          <label>
            {t.owner.fieldStaff}
            <select
              required
              disabled={Boolean(editingPaymentId)}
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
          <label>
            {t.owner.fieldDate}
            <input
              type="datetime-local"
              value={form.paidAt}
              onChange={(e) => setForm({ ...form, paidAt: e.target.value })}
            />
          </label>
          <label className="full">
            {t.owner.fieldNote}
            <input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </label>
          <div className="media-actions full">
            <button
              type="submit"
              className="cta"
              disabled={pending || !form.userId}
            >
              {editingPaymentId ? t.common.save : t.owner.paySalary}
            </button>
            {editingPaymentId ? (
              <button
                type="button"
                className="btn ghost compact"
                onClick={cancelEditPayment}
              >
                {t.owner.cancelEditSalary}
              </button>
            ) : null}
          </div>
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
              {isOwner ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td colSpan={isOwner ? 6 : 5} className="muted">
                  {t.owner.paymentsEmpty}
                </td>
              </tr>
            ) : (
              payments.map((p) => (
                <tr
                  key={p.id}
                  className={p.isReversed ? "dim" : undefined}
                >
                  <td data-label={t.owner.fieldDate}>
                    {new Date(p.paidAt).toLocaleString()}
                  </td>
                  <td data-label={t.owner.fieldStaff}>
                    {p.staff.name}
                    <div className="muted tiny">{p.staff.role}</div>
                    {p.isReversed ? (
                      <div className="price-override">
                        {t.owner.statusReversed}
                        {p.reverseReason ? ` — ${p.reverseReason}` : ""}
                      </div>
                    ) : null}
                  </td>
                  <td data-label={t.owner.fieldPeriod}>
                    {p.periodLabel ?? "—"}
                  </td>
                  <td data-label={t.owner.fieldAmount}>
                    ৳{p.amountBdt.toLocaleString()}
                  </td>
                  <td data-label={t.owner.fieldNote}>{p.note ?? "—"}</td>
                  {isOwner ? (
                    <td className="cell-actions" data-label="">
                      {!p.isReversed ? (
                        <>
                          <button
                            type="button"
                            className="linkish"
                            onClick={() => startEditPayment(p)}
                          >
                            {t.owner.editSalary}
                          </button>
                          <button
                            type="button"
                            className="linkish"
                            onClick={() => void onReverse(p)}
                          >
                            {t.owner.reverseSalary}
                          </button>
                        </>
                      ) : (
                        <span className="muted tiny">—</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
