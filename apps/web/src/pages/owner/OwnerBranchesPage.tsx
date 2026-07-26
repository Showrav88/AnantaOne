import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import {
  confirmDetails,
  useConfirmAction,
} from "../../components/ConfirmActionDialog";
import { api, type BranchRow, type StaffMember } from "../../lib/api";
import { getStoredUser } from "../../lib/session";

type Props = { locale: LocaleCode };

const emptyForm = {
  name: "",
  address: "",
  phone: "",
  managerId: "",
  employeeIds: [] as string[],
};

export function OwnerBranchesPage({ locale }: Props) {
  const t = getMessages(locale);
  const { confirm } = useConfirmAction();
  const user = getStoredUser();
  const isOwner = user?.role.code === "OWNER";
  const canView =
    user?.role.code === "OWNER" || user?.role.code === "MANAGER";
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const assignable = staff.filter(
    (s) => s.isActive && (s.role.code === "MANAGER" || s.role.code === "EMPLOYEE"),
  );

  async function load() {
    const [b, s] = await Promise.all([
      api.owner.branches(),
      api.owner.staff(),
    ]);
    setBranches(b.branches);
    setStaff(s.staff);
  }

  useEffect(() => {
    if (!canView) return;
    startTransition(() => {
      void load().catch((err) =>
        setError(err instanceof Error ? err.message : "Failed"),
      );
    });
  }, [canView]);

  function startEdit(branch: BranchRow) {
    setEditingId(branch.id);
    setForm({
      name: branch.name,
      address: branch.address ?? "",
      phone: branch.phone ?? "",
      managerId: branch.managerId ?? "",
      employeeIds: branch.staff
        .filter((s) => s.id !== branch.managerId)
        .map((s) => s.id),
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function toggleEmployee(id: string) {
    setForm((prev) => {
      const has = prev.employeeIds.includes(id);
      return {
        ...prev,
        employeeIds: has
          ? prev.employeeIds.filter((x) => x !== id)
          : [...prev.employeeIds, id],
      };
    });
  }

  function staffLabel(id: string) {
    const member = staff.find((s) => s.id === id);
    return member ? `${member.name} (${member.role.code})` : id;
  }

  function branchDetails(branch: BranchRow) {
    return confirmDetails(
      [
        { label: t.common.fieldId, value: branch.id },
        { label: t.owner.fieldBranchName, value: branch.name },
        { label: t.owner.fieldAddress, value: branch.address },
        { label: t.owner.fieldPhone, value: branch.phone },
        { label: t.owner.fieldBranchManager, value: branch.manager?.name ?? branch.managerId },
        {
          label: t.owner.fieldBranchStaff,
          value: branch.staff.map((s) => `${s.name} (${s.role.code})`).join(", "),
        },
      ],
      { skipEmpty: true },
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isOwner) return;
    setError(null);
    if (!form.managerId) {
      setError(t.owner.managerRequired);
      return;
    }
    const body = {
      name: form.name.trim(),
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      managerId: form.managerId,
      employeeIds: form.employeeIds.filter((id) => id !== form.managerId),
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
          { label: t.owner.fieldBranchName, value: body.name },
          { label: t.owner.fieldAddress, value: body.address },
          { label: t.owner.fieldPhone, value: body.phone },
          { label: t.owner.fieldBranchManager, value: staffLabel(body.managerId) },
          {
            label: t.owner.fieldBranchEmployees,
            value: body.employeeIds.map(staffLabel).join(", "),
          },
        ],
        { skipEmpty: true },
      ),
    });
    if (!decision.ok) return;

    try {
      if (editingId) {
        await api.owner.updateBranch(editingId, body);
      } else {
        await api.owner.createBranch(body);
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function deactivate(branch: BranchRow) {
    setError(null);
    const decision = await confirm({
      title: t.common.confirmDeleteTitle,
      message: t.common.confirmDeleteMessage,
      tone: "danger",
      confirmLabel: t.common.confirmDelete,
      cancelLabel: t.common.cancel,
      details: branchDetails(branch),
    });
    if (!decision.ok) return;

    try {
      await api.owner.deactivateBranch(branch.id);
      if (editingId === branch.id) resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  if (!canView) {
    return (
      <div className="owner-page">
        <p className="muted">{t.owner.branchesDenied}</p>
      </div>
    );
  }

  return (
    <div className="owner-page">
      <header className="owner-header">
        <div>
          <p className="eyebrow">{t.owner.navBranches}</p>
          <h1>{t.owner.branchesTitle}</h1>
          <p className="muted">{t.owner.branchesHint}</p>
        </div>
        <div className="header-links">
          <Link className="btn ghost" to="/owner/staff">
            {t.owner.navStaff}
          </Link>
          <Link className="btn ghost" to="/owner/company">
            {t.owner.navCompany}
          </Link>
        </div>
      </header>

      {error ? <p className="error-banner">{error}</p> : null}

      {isOwner ? (
        <form className="owner-form compact" onSubmit={(e) => void onSubmit(e)}>
          <label>
            {t.owner.fieldBranchName}
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
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
            {t.owner.fieldPhone}
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>
          <p className="muted tiny full">{t.owner.branchAssignHint}</p>
          <label>
            {t.owner.fieldBranchManager}
            <select
              required
              value={form.managerId}
              onChange={(e) => {
                const managerId = e.target.value;
                setForm({
                  ...form,
                  managerId,
                  employeeIds: form.employeeIds.filter((id) => id !== managerId),
                });
              }}
            >
              <option value="">{t.owner.selectManager}</option>
              {assignable.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.role.code})
                </option>
              ))}
            </select>
          </label>
          <fieldset className="full branch-employees">
            <legend>{t.owner.fieldBranchEmployees}</legend>
            <p className="muted tiny">{t.owner.branchEmployeesHint}</p>
            {assignable.filter((s) => s.id !== form.managerId).length === 0 ? (
              <p className="muted tiny">{t.owner.noStaffToAssign}</p>
            ) : (
              <ul className="check-list">
                {assignable
                  .filter((s) => s.id !== form.managerId)
                  .map((s) => (
                  <li key={s.id}>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={form.employeeIds.includes(s.id)}
                        onChange={() => toggleEmployee(s.id)}
                      />
                      <span>
                        {s.name}
                        <span className="muted tiny"> · {s.role.code}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
          <div className="form-actions full">
            <button type="submit" className="cta" disabled={pending}>
              {editingId ? t.common.save : t.owner.addBranch}
            </button>
            {editingId ? (
              <button type="button" className="btn ghost" onClick={resetForm}>
                {t.common.cancel}
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <p className="muted">{t.owner.branchesOwnerOnly}</p>
      )}

      <div className="owner-table-wrap">
        <table className="owner-table">
          <thead>
            <tr>
              <th>{t.owner.fieldBranchName}</th>
              <th>{t.owner.fieldBranchManager}</th>
              <th>{t.owner.fieldBranchStaff}</th>
              <th>{t.owner.fieldStatus}</th>
              {isOwner ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {branches.length === 0 ? (
              <tr>
                <td colSpan={isOwner ? 5 : 4}>
                  <p className="muted">{t.owner.branchesEmpty}</p>
                </td>
              </tr>
            ) : (
              branches.map((b) => (
                <tr key={b.id}>
                  <td data-label={t.owner.fieldBranchName}>
                    <strong>{b.name}</strong>
                    {b.address ? (
                      <div className="muted tiny">{b.address}</div>
                    ) : null}
                    {b.phone ? (
                      <div className="muted tiny">{b.phone}</div>
                    ) : null}
                  </td>
                  <td data-label={t.owner.fieldBranchManager}>
                    {b.manager ? b.manager.name : "—"}
                  </td>
                  <td data-label={t.owner.fieldBranchStaff}>
                    {b.staff.length > 0 ? (
                      <ul className="branch-staff-list">
                        {b.staff.map((s) => {
                          const isMgr = s.id === b.managerId;
                          const roleLabel = isMgr
                            ? t.owner.staffRoleManager
                            : s.role.code === "MANAGER"
                              ? t.owner.staffRoleManager
                              : t.owner.staffRoleEmployee;
                          return (
                            <li key={s.id}>
                              {s.name}
                              <span className="muted tiny"> · {roleLabel}</span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td data-label={t.owner.fieldStatus}>
                    {b.isActive ? "✓" : "—"}
                  </td>
                  {isOwner ? (
                    <td className="cell-actions" data-label="">
                      <button
                        type="button"
                        className="linkish"
                        onClick={() => startEdit(b)}
                      >
                        {t.common.edit}
                      </button>
                      {b.isActive ? (
                        <button
                          type="button"
                          className="linkish"
                          onClick={() => void deactivate(b)}
                        >
                          {t.owner.deactivate}
                        </button>
                      ) : null}
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
