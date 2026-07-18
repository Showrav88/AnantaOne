import { useEffect, useState, useTransition, type FormEvent } from "react";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import { api, type StaffMember } from "../../lib/api";
import { getStoredUser } from "../../lib/session";

type Props = { locale: LocaleCode };

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  password: "",
  roleCode: "EMPLOYEE" as "MANAGER" | "EMPLOYEE",
  employeeCode: "",
  designation: "",
  joiningDate: "",
  salaryBdt: "",
};

export function OwnerStaffPage({ locale }: Props) {
  const t = getMessages(locale);
  const user = getStoredUser();
  const isOwner = user?.role.code === "OWNER";
  const canView =
    user?.role.code === "OWNER" || user?.role.code === "MANAGER";
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function load() {
    const res = await api.owner.staff();
    setStaff(res.staff);
  }

  useEffect(() => {
    if (!canView) return;
    startTransition(() => {
      void load().catch((err) =>
        setError(err instanceof Error ? err.message : "Failed"),
      );
    });
  }, [canView]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.owner.createStaff({
        name: form.name,
        email: form.email,
        phone: form.phone || null,
        password: form.password,
        roleCode: form.roleCode,
        employeeCode: form.employeeCode || null,
        designation: form.designation || null,
        joiningDate: form.joiningDate || null,
        salaryBdt: form.salaryBdt === "" ? null : Number(form.salaryBdt),
      });
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function deactivate(id: string) {
    setError(null);
    try {
      await api.owner.deactivateStaff(id);
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
          <p className="eyebrow">{t.owner.navStaff}</p>
          <h1>{t.owner.staffTitle}</h1>
          <p className="muted">{t.owner.staffHint}</p>
        </div>
      </header>

      {error ? <p className="error-banner">{error}</p> : null}

      {isOwner ? (
        <form className="owner-form compact" onSubmit={onCreate}>
          <label>
            {t.owner.fieldStaffName}
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            {t.auth.email}
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label>
            {t.auth.phone}
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>
          <label>
            {t.auth.password}
            <input
              required
              type="password"
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
          <label>
            {t.owner.fieldRole}
            <select
              value={form.roleCode}
              onChange={(e) =>
                setForm({
                  ...form,
                  roleCode: e.target.value as "MANAGER" | "EMPLOYEE",
                })
              }
            >
              <option value="MANAGER">{t.owner.roleManager}</option>
              <option value="EMPLOYEE">{t.owner.roleEmployee}</option>
            </select>
          </label>
          <label>
            {t.owner.fieldEmployeeCode}
            <input
              value={form.employeeCode}
              onChange={(e) =>
                setForm({ ...form, employeeCode: e.target.value })
              }
            />
          </label>
          <label>
            {t.owner.fieldDesignation}
            <input
              value={form.designation}
              onChange={(e) =>
                setForm({ ...form, designation: e.target.value })
              }
            />
          </label>
          <label>
            {t.owner.fieldJoiningDate}
            <input
              type="date"
              value={form.joiningDate}
              onChange={(e) =>
                setForm({ ...form, joiningDate: e.target.value })
              }
            />
          </label>
          <label>
            {t.owner.fieldSalary}
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.salaryBdt}
              onChange={(e) => setForm({ ...form, salaryBdt: e.target.value })}
            />
          </label>
          <button type="submit" className="cta" disabled={pending}>
            {t.owner.addStaff}
          </button>
        </form>
      ) : (
        <p className="muted">{t.owner.staffOwnerOnly}</p>
      )}

      <div className="owner-table-wrap">
        <table className="owner-table">
          <thead>
            <tr>
              <th>{t.owner.fieldStaffName}</th>
              <th>{t.owner.fieldRole}</th>
              <th>{t.owner.fieldJoiningDate}</th>
              <th>{t.owner.fieldSalary}</th>
              <th>{t.owner.fieldStatus}</th>
              {isOwner ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id}>
                <td data-label={t.owner.fieldStaffName}>
                  <strong>{s.name}</strong>
                  <div className="muted tiny">{s.email}</div>
                  {s.designation ? (
                    <div className="muted tiny">{s.designation}</div>
                  ) : null}
                </td>
                <td data-label={t.owner.fieldRole}>{s.role.code}</td>
                <td data-label={t.owner.fieldJoiningDate}>
                  {s.joiningDate
                    ? new Date(s.joiningDate).toLocaleDateString()
                    : "—"}
                </td>
                <td data-label={t.owner.fieldSalary}>
                  {s.salaryBdt != null
                    ? `৳${s.salaryBdt.toLocaleString()}`
                    : "—"}
                </td>
                <td data-label={t.owner.fieldStatus}>
                  {s.isActive ? "✓" : "—"}
                </td>
                {isOwner && s.role.code !== "OWNER" && s.isActive ? (
                  <td className="cell-actions" data-label="">
                    <button
                      type="button"
                      className="linkish"
                      onClick={() => void deactivate(s.id)}
                    >
                      {t.owner.deactivate}
                    </button>
                  </td>
                ) : isOwner ? (
                  <td className="cell-actions" data-label="" />
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
