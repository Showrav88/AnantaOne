import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import { api, type BranchRow, type StaffMember } from "../../lib/api";
import { getStoredUser } from "../../lib/session";
import { uploadTenantMedia } from "../../lib/tenantUpload";

type Props = { locale: LocaleCode };

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  password: "",
  roleCode: "EMPLOYEE" as "MANAGER" | "EMPLOYEE",
  branchId: "",
  employeeCode: "",
  designation: "",
  joiningDate: "",
  salaryBdt: "",
};

function joiningDateInput(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 10);
}

export function OwnerStaffPage({ locale }: Props) {
  const t = getMessages(locale);
  const user = getStoredUser();
  const isOwner = user?.role.code === "OWNER";
  const canView =
    user?.role.code === "OWNER" || user?.role.code === "MANAGER";
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [clearExistingImage, setClearExistingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [detailMember, setDetailMember] = useState<StaffMember | null>(null);
  const [deactivateMember, setDeactivateMember] =
    useState<StaffMember | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  async function load() {
    const [s, b] = await Promise.all([
      api.owner.staff(),
      api.owner.branches(),
    ]);
    setStaff(s.staff);
    setBranches(b.branches.filter((x) => x.isActive));
  }

  useEffect(() => {
    if (!canView) return;
    startTransition(() => {
      void load().catch((err) =>
        setError(err instanceof Error ? err.message : "Failed"),
      );
    });
  }, [canView]);

  function clearImagePicker() {
    setImageFile(null);
    setImagePreview(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    clearImagePicker();
    setExistingImageUrl(null);
    setClearExistingImage(false);
  }

  function startEdit(member: StaffMember) {
    if (member.role.code === "OWNER") return;
    setEditingId(member.id);
    setForm({
      name: member.name,
      email: member.email,
      phone: member.phone ?? "",
      password: "",
      roleCode:
        member.role.code === "MANAGER" ? "MANAGER" : "EMPLOYEE",
      branchId: member.branchId ?? "",
      employeeCode: member.employeeCode ?? "",
      designation: member.designation ?? "",
      joiningDate: joiningDateInput(member.joiningDate),
      salaryBdt: member.salaryBdt != null ? String(member.salaryBdt) : "",
    });
    clearImagePicker();
    setExistingImageUrl(member.imageUrl);
    setClearExistingImage(false);
    setError(null);
    setOkMsg(null);
  }

  function onPickImage(file: File | null) {
    clearImagePicker();
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setClearExistingImage(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isOwner) return;
    setError(null);
    setOkMsg(null);
    setUploading(true);
    try {
      let imageUrl: string | null | undefined;
      let imagePublicId: string | null | undefined;

      if (imageFile) {
        const publicIdBase = (form.employeeCode || form.email || form.name)
          .trim()
          .replace(/[^a-zA-Z0-9_-]/g, "_")
          .slice(0, 40);
        const { uploaded } = await uploadTenantMedia({
          file: imageFile,
          purpose: "staff",
          publicId: publicIdBase || undefined,
          label: form.name,
          staffId: editingId ?? undefined,
        });
        imageUrl = uploaded.url;
        imagePublicId = uploaded.publicId;
      }

      if (editingId) {
        const body: Record<string, unknown> = {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          roleCode: form.roleCode,
          branchId: form.branchId || null,
          employeeCode: form.employeeCode.trim() || null,
          designation: form.designation.trim() || null,
          joiningDate: form.joiningDate || null,
          salaryBdt: form.salaryBdt === "" ? null : Number(form.salaryBdt),
        };
        if (form.password.trim()) {
          body.password = form.password;
        }
        if (imageUrl) {
          body.imageUrl = imageUrl;
          body.imagePublicId = imagePublicId;
        } else if (clearExistingImage) {
          body.clearImage = true;
        }
        await api.owner.updateStaff(editingId, body);
        setOkMsg(t.owner.staffUpdated);
      } else {
        await api.owner.createStaff({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          password: form.password,
          roleCode: form.roleCode,
          branchId: form.branchId || null,
          employeeCode: form.employeeCode.trim() || null,
          designation: form.designation.trim() || null,
          joiningDate: form.joiningDate || null,
          salaryBdt: form.salaryBdt === "" ? null : Number(form.salaryBdt),
          imageUrl: imageUrl ?? null,
          imagePublicId: imagePublicId ?? null,
        });
        setOkMsg(t.owner.staffCreated);
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setUploading(false);
    }
  }

  async function onStaffImage(id: string, file: File | null, label: string) {
    if (!file || !isOwner) return;
    setError(null);
    setOkMsg(null);
    setUploading(true);
    try {
      await uploadTenantMedia({
        file,
        purpose: "staff",
        publicId: id.slice(0, 24),
        label,
        staffId: id,
      });
      setOkMsg(t.owner.mediaUploaded);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onBranchChange(staffId: string, branchId: string) {
    setError(null);
    try {
      await api.owner.updateStaff(staffId, {
        branchId: branchId || null,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function confirmDeactivate() {
    if (!deactivateMember) return;
    setError(null);
    setDeactivating(true);
    try {
      await api.owner.deactivateStaff(deactivateMember.id);
      if (editingId === deactivateMember.id) resetForm();
      if (detailMember?.id === deactivateMember.id) setDetailMember(null);
      setDeactivateMember(null);
      setOkMsg(t.owner.staffDeactivated);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setDeactivating(false);
    }
  }

  function roleLabel(member: StaffMember) {
    if (member.role.code === "OWNER") return t.owner.staffRoleOwner;
    if (member.role.code === "MANAGER") return t.owner.staffRoleManager;
    if (member.role.code === "EMPLOYEE") return t.owner.staffRoleEmployee;
    return locale === "bn" ? member.role.nameBn : member.role.nameEn;
  }

  const previewUrl =
    imagePreview ??
    (!clearExistingImage ? existingImageUrl : null);

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
        <div className="header-links">
          <Link className="btn ghost" to="/owner/branches">
            {t.owner.manageBranches}
          </Link>
        </div>
      </header>

      {okMsg ? <p className="ok">{okMsg}</p> : null}
      {error ? <p className="error-banner">{error}</p> : null}

      {isOwner ? (
        <form className="owner-form compact" onSubmit={(e) => void onSubmit(e)}>
          <label className="full">
            {t.owner.fieldStaffPhoto}
            <span className="muted tiny">{t.owner.staffPhotoHint}</span>
            <div className="staff-photo-field">
              {previewUrl ? (
                <img className="staff-thumb lg" src={previewUrl} alt="" />
              ) : (
                <span className="staff-thumb lg placeholder" />
              )}
              <div className="staff-photo-actions">
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploading}
                  onChange={(e) => {
                    onPickImage(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
                {previewUrl ? (
                  <button
                    type="button"
                    className="btn ghost compact"
                    onClick={() => {
                      clearImagePicker();
                      if (existingImageUrl) setClearExistingImage(true);
                    }}
                  >
                    {t.owner.clearStaffPhoto}
                  </button>
                ) : null}
              </div>
            </div>
          </label>
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
            {editingId ? t.owner.fieldPasswordOptional : t.auth.password}
            <input
              required={!editingId}
              type="password"
              minLength={8}
              value={form.password}
              placeholder={editingId ? t.owner.passwordKeepHint : undefined}
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
              <option value="MANAGER">{t.owner.staffRoleManager}</option>
              <option value="EMPLOYEE">{t.owner.staffRoleEmployee}</option>
            </select>
          </label>
          <label>
            {t.owner.fieldBranch}
            <select
              value={form.branchId}
              onChange={(e) => setForm({ ...form, branchId: e.target.value })}
            >
              <option value="">{t.owner.noBranch}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
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
          <div className="form-actions full">
            <button type="submit" className="cta" disabled={pending || uploading}>
              {editingId ? t.common.save : t.owner.addStaff}
            </button>
            {editingId ? (
              <button type="button" className="btn ghost" onClick={resetForm}>
                {t.common.cancel}
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <p className="muted">{t.owner.staffOwnerOnly}</p>
      )}

      <div className="owner-table-wrap">
        <table className="owner-table">
          <thead>
            <tr>
              <th>{t.owner.fieldStaffName}</th>
              <th>{t.owner.fieldEmployeeCode}</th>
              <th>{t.owner.fieldRole}</th>
              <th>{t.owner.fieldDesignation}</th>
              <th>{t.auth.phone}</th>
              <th>{t.owner.fieldBranch}</th>
              <th>{t.owner.fieldJoiningDate}</th>
              <th>{t.owner.fieldSalary}</th>
              <th>{t.owner.fieldStatus}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className={s.isActive ? undefined : "row-inactive"}>
                <td data-label={t.owner.fieldStaffName}>
                  <div className="staff-name-cell">
                    {s.imageUrl ? (
                      <img className="staff-thumb" src={s.imageUrl} alt="" />
                    ) : (
                      <span className="staff-thumb placeholder" aria-hidden />
                    )}
                    <div className="staff-name-meta">
                      <strong>{s.name}</strong>
                      <div className="muted tiny">{s.email}</div>
                      {isOwner && s.role.code !== "OWNER" && s.isActive ? (
                        <label className="upload-field compact">
                          <span className="muted tiny">
                            {t.owner.changeStaffPhoto}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            disabled={uploading}
                            onChange={(e) => {
                              void onStaffImage(
                                s.id,
                                e.target.files?.[0] ?? null,
                                s.name,
                              );
                              e.target.value = "";
                            }}
                          />
                        </label>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td data-label={t.owner.fieldEmployeeCode}>
                  {s.employeeCode || "—"}
                </td>
                <td data-label={t.owner.fieldRole}>{roleLabel(s)}</td>
                <td data-label={t.owner.fieldDesignation}>
                  {s.designation || "—"}
                </td>
                <td data-label={t.auth.phone}>{s.phone || "—"}</td>
                <td data-label={t.owner.fieldBranch}>
                  {isOwner && s.role.code !== "OWNER" && s.isActive ? (
                    <select
                      value={s.branchId ?? ""}
                      onChange={(e) =>
                        void onBranchChange(s.id, e.target.value)
                      }
                    >
                      <option value="">{t.owner.noBranch}</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    (s.branch?.name ?? "—")
                  )}
                </td>
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
                  {s.isActive ? t.owner.statusActive : t.owner.statusInactive}
                </td>
                <td className="cell-actions" data-label="">
                  <button
                    type="button"
                    className="linkish"
                    onClick={() => setDetailMember(s)}
                  >
                    {t.owner.staffDetails}
                  </button>
                  {isOwner && s.role.code !== "OWNER" ? (
                    <>
                      <button
                        type="button"
                        className="linkish"
                        onClick={() => startEdit(s)}
                      >
                        {t.common.edit}
                      </button>
                      {s.isActive ? (
                        <button
                          type="button"
                          className="linkish"
                          onClick={() => setDeactivateMember(s)}
                        >
                          {t.owner.deactivate}
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detailMember ? (
        <div
          className="owner-dialog-backdrop"
          role="presentation"
          onClick={() => setDetailMember(null)}
        >
          <div
            className="owner-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="owner-dialog-head">
              <div className="staff-name-cell">
                {detailMember.imageUrl ? (
                  <img
                    className="staff-thumb lg"
                    src={detailMember.imageUrl}
                    alt=""
                  />
                ) : (
                  <span className="staff-thumb lg placeholder" aria-hidden />
                )}
                <div>
                  <h2 id="staff-detail-title">{detailMember.name}</h2>
                  <p className="muted tiny">{roleLabel(detailMember)}</p>
                </div>
              </div>
              <button
                type="button"
                className="btn ghost compact"
                onClick={() => setDetailMember(null)}
              >
                {t.common.close}
              </button>
            </header>
            <dl className="staff-detail-grid">
              <div>
                <dt>{t.owner.fieldEmployeeCode}</dt>
                <dd>{detailMember.employeeCode || "—"}</dd>
              </div>
              <div>
                <dt>{t.owner.fieldDesignation}</dt>
                <dd>{detailMember.designation || "—"}</dd>
              </div>
              <div>
                <dt>{t.auth.email}</dt>
                <dd>{detailMember.email}</dd>
              </div>
              <div>
                <dt>{t.auth.phone}</dt>
                <dd>{detailMember.phone || "—"}</dd>
              </div>
              <div>
                <dt>{t.owner.fieldBranch}</dt>
                <dd>{detailMember.branch?.name || t.owner.noBranch}</dd>
              </div>
              <div>
                <dt>{t.owner.fieldJoiningDate}</dt>
                <dd>
                  {detailMember.joiningDate
                    ? new Date(detailMember.joiningDate).toLocaleDateString()
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>{t.owner.fieldSalary}</dt>
                <dd>
                  {detailMember.salaryBdt != null
                    ? `৳${detailMember.salaryBdt.toLocaleString()}`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>{t.owner.fieldStatus}</dt>
                <dd>
                  {detailMember.isActive
                    ? t.owner.statusActive
                    : t.owner.statusInactive}
                </dd>
              </div>
            </dl>
            <div className="form-actions">
              {isOwner && detailMember.role.code !== "OWNER" ? (
                <>
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => {
                      startEdit(detailMember);
                      setDetailMember(null);
                    }}
                  >
                    {t.common.edit}
                  </button>
                  {detailMember.isActive ? (
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => {
                        setDeactivateMember(detailMember);
                        setDetailMember(null);
                      }}
                    >
                      {t.owner.deactivate}
                    </button>
                  ) : null}
                </>
              ) : null}
              <button
                type="button"
                className="btn ghost"
                onClick={() => setDetailMember(null)}
              >
                {t.common.close}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deactivateMember ? (
        <div
          className="owner-dialog-backdrop"
          role="presentation"
          onClick={() => (!deactivating ? setDeactivateMember(null) : null)}
        >
          <div
            className="owner-dialog confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-deactivate-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="staff-deactivate-title">{t.owner.deactivateStaffTitle}</h2>
            <p>
              {t.owner.deactivateStaffHint.replace(
                "{name}",
                deactivateMember.name,
              )}
            </p>
            <ul className="staff-deactivate-summary">
              <li>
                <span className="muted">{t.owner.fieldEmployeeCode}</span>{" "}
                {deactivateMember.employeeCode || "—"}
              </li>
              <li>
                <span className="muted">{t.owner.fieldRole}</span>{" "}
                {roleLabel(deactivateMember)}
              </li>
              <li>
                <span className="muted">{t.auth.email}</span>{" "}
                {deactivateMember.email}
              </li>
            </ul>
            <div className="form-actions">
              <button
                type="button"
                className="cta danger"
                disabled={deactivating}
                onClick={() => void confirmDeactivate()}
              >
                {t.owner.confirmDeactivateStaff}
              </button>
              <button
                type="button"
                className="btn ghost"
                disabled={deactivating}
                onClick={() => setDeactivateMember(null)}
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
