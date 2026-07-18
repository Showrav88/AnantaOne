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

  async function deactivate(id: string) {
    setError(null);
    try {
      await api.owner.deactivateStaff(id);
      if (editingId === id) resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
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
              <option value="MANAGER">{t.owner.roleManager}</option>
              <option value="EMPLOYEE">{t.owner.roleEmployee}</option>
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
              <th>{t.owner.fieldRole}</th>
              <th>{t.owner.fieldBranch}</th>
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
                  <div className="staff-name-cell">
                    {s.imageUrl ? (
                      <img className="staff-thumb" src={s.imageUrl} alt="" />
                    ) : (
                      <span className="staff-thumb placeholder" aria-hidden />
                    )}
                    <div className="staff-name-meta">
                      <strong>{s.name}</strong>
                      <div className="muted tiny">{s.email}</div>
                      {s.phone ? (
                        <div className="muted tiny">{s.phone}</div>
                      ) : null}
                      {s.designation ? (
                        <div className="muted tiny">{s.designation}</div>
                      ) : null}
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
                <td data-label={t.owner.fieldRole}>{s.role.code}</td>
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
                  {s.isActive ? "✓" : "—"}
                </td>
                {isOwner && s.role.code !== "OWNER" && s.isActive ? (
                  <td className="cell-actions" data-label="">
                    <button
                      type="button"
                      className="linkish"
                      onClick={() => startEdit(s)}
                    >
                      {t.common.edit}
                    </button>
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
