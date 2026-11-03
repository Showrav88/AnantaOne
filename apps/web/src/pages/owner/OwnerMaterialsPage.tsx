import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import {
  confirmDetails,
  useConfirmAction,
} from "../../components/ConfirmActionDialog";
import { api, type MaterialRow } from "../../lib/api";
import { getStoredUser } from "../../lib/session";

type Props = { locale: LocaleCode };

const emptyForm = {
  name: "",
  nameBn: "",
  code: "",
  kindCode: "RAW_MATERIAL",
  unitCode: "PIECE",
  minStock: "",
};

export function OwnerMaterialsPage({ locale }: Props) {
  const t = getMessages(locale);
  const { confirm } = useConfirmAction();
  const user = getStoredUser();
  const canWrite =
    user?.role.code === "OWNER" || user?.role.code === "MANAGER";
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [kinds, setKinds] = useState<
    Array<{ code: string; nameEn: string; nameBn: string }>
  >([]);
  const [units, setUnits] = useState<
    Array<{ code: string; nameEn: string; nameBn: string }>
  >([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function labelKind(code: string) {
    const k = kinds.find((x) => x.code === code);
    if (!k) return code;
    return locale === "bn" ? k.nameBn : k.nameEn;
  }

  function labelUnit(code: string) {
    const u = units.find((x) => x.code === code);
    if (!u) return code;
    return locale === "bn" ? u.nameBn : u.nameEn;
  }

  async function load() {
    const [m, meta] = await Promise.all([
      api.owner.materials(),
      api.owner.supplyMeta(),
    ]);
    setMaterials(m.materials);
    setKinds(meta.kinds);
    setUnits(meta.units);
    setForm((f) => ({
      ...f,
      kindCode: meta.kinds.some((k) => k.code === f.kindCode)
        ? f.kindCode
        : (meta.kinds[0]?.code ?? "RAW_MATERIAL"),
      unitCode: meta.units.some((u) => u.code === f.unitCode)
        ? f.unitCode
        : (meta.units[0]?.code ?? "PIECE"),
    }));
  }

  useEffect(() => {
    startTransition(() => {
      void load().catch((err) =>
        setError(err instanceof Error ? err.message : "Failed"),
      );
    });
  }, []);

  function startEdit(row: MaterialRow) {
    setEditingId(row.id);
    setForm({
      name: row.name,
      nameBn: row.nameBn ?? "",
      code: row.code ?? "",
      kindCode: row.kind.code,
      unitCode: row.unit.code,
      minStock: row.minStock != null ? String(row.minStock) : "",
    });
    setOkMsg(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    setError(null);
    setOkMsg(null);

    const body = {
      name: form.name.trim(),
      nameBn: form.nameBn.trim() || null,
      code: form.code.trim() || null,
      kindCode: form.kindCode,
      unitCode: form.unitCode,
      minStock: form.minStock.trim() ? Number(form.minStock) : null,
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
          { label: t.owner.fieldMaterial, value: body.name },
          { label: t.owner.fieldMaterialNameBn, value: body.nameBn },
          { label: t.owner.fieldMaterialCode, value: body.code },
          { label: t.owner.fieldSupplyKind, value: labelKind(body.kindCode) },
          { label: t.owner.fieldUnit, value: labelUnit(body.unitCode) },
          { label: t.owner.fieldMinStock, value: body.minStock },
        ],
        { skipEmpty: true },
      ),
    });
    if (!decision.ok) return;

    try {
      if (editingId) {
        await api.owner.updateMaterialCatalog(editingId, body);
        setOkMsg(t.owner.materialUpdated);
      } else {
        await api.owner.createMaterialCatalog(body);
        setOkMsg(t.owner.materialCreated);
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function deactivate(row: MaterialRow) {
    setError(null);
    const decision = await confirm({
      title: t.common.confirmDeleteTitle,
      message: t.common.confirmDeleteMessage,
      tone: "danger",
      confirmLabel: t.common.confirmDelete,
      cancelLabel: t.common.cancel,
      details: confirmDetails(
        [
          { label: t.common.fieldId, value: row.id },
          { label: t.owner.fieldMaterial, value: row.name },
          { label: t.owner.fieldMaterialCode, value: row.code },
          { label: t.owner.fieldSupplyKind, value: labelKind(row.kind.code) },
        ],
        { skipEmpty: true },
      ),
    });
    if (!decision.ok) return;

    try {
      await api.owner.updateMaterialCatalog(row.id, { isActive: false });
      if (editingId === row.id) resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="owner-page">
      <header className="owner-header">
        <div>
          <p className="eyebrow">{t.owner.navMaterials}</p>
          <h1>{t.owner.materialsTitle}</h1>
          <p className="muted">{t.owner.materialsHint}</p>
        </div>
        <div className="header-links">
          <Link className="btn ghost" to="/owner/wallet?tab=supply">
            {t.owner.walletTabSupply}
          </Link>
          <Link className="btn ghost" to="/owner/products">
            {t.owner.navProducts}
          </Link>
        </div>
      </header>

      {okMsg ? <p className="ok">{okMsg}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {canWrite ? (
        <form className="owner-form compact" onSubmit={(e) => void onSubmit(e)}>
          <label>
            {t.owner.fieldMaterial}
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            {t.owner.fieldMaterialNameBn}
            <input
              value={form.nameBn}
              onChange={(e) => setForm({ ...form, nameBn: e.target.value })}
            />
          </label>
          <label>
            {t.owner.fieldMaterialCode}
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </label>
          <label>
            {t.owner.fieldSupplyKind}
            <select
              value={form.kindCode}
              onChange={(e) =>
                setForm({ ...form, kindCode: e.target.value })
              }
            >
              {kinds.map((k) => (
                <option key={k.code} value={k.code}>
                  {locale === "bn" ? k.nameBn : k.nameEn}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.owner.fieldUnit}
            <select
              value={form.unitCode}
              onChange={(e) =>
                setForm({ ...form, unitCode: e.target.value })
              }
            >
              {units.map((u) => (
                <option key={u.code} value={u.code}>
                  {locale === "bn" ? u.nameBn : u.nameEn}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.owner.fieldMinStock}
            <input
              type="number"
              min={0}
              step="any"
              value={form.minStock}
              onChange={(e) =>
                setForm({ ...form, minStock: e.target.value })
              }
            />
          </label>
          <div className="form-actions full">
            <button type="submit" className="cta" disabled={pending}>
              {editingId ? t.common.save : t.owner.addMaterial}
            </button>
            {editingId ? (
              <button type="button" className="btn ghost" onClick={resetForm}>
                {t.common.cancel}
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <p className="muted">{t.owner.materialsOwnerOnly}</p>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t.owner.fieldMaterial}</th>
              <th>{t.owner.fieldMaterialCode}</th>
              <th>{t.owner.fieldSupplyKind}</th>
              <th>{t.owner.fieldUnit}</th>
              <th>{t.owner.fieldMinStock}</th>
              <th>{t.owner.fieldStatus}</th>
              {canWrite ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {materials.length === 0 ? (
              <tr>
                <td colSpan={canWrite ? 7 : 6}>
                  <p className="muted">{t.owner.materialsEmpty}</p>
                </td>
              </tr>
            ) : (
              materials.map((m) => (
                <tr key={m.id} className={m.isActive ? "" : "dim"}>
                  <td data-label={t.owner.fieldMaterial}>
                    {locale === "bn" && m.nameBn ? m.nameBn : m.name}
                    {locale === "bn" && m.nameBn ? (
                      <div className="muted tiny">{m.name}</div>
                    ) : m.nameBn ? (
                      <div className="muted tiny">{m.nameBn}</div>
                    ) : null}
                  </td>
                  <td className="cell-id" data-label={t.owner.fieldMaterialCode}>
                    {m.code ?? "—"}
                  </td>
                  <td data-label={t.owner.fieldSupplyKind}>
                    {labelKind(m.kind.code)}
                  </td>
                  <td data-label={t.owner.fieldUnit}>
                    {labelUnit(m.unit.code)}
                  </td>
                  <td data-label={t.owner.fieldMinStock}>
                    {m.minStock ?? "—"}
                  </td>
                  <td data-label={t.owner.fieldStatus}>
                    {m.isActive ? "✓" : "—"}
                  </td>
                  {canWrite ? (
                    <td className="cell-actions" data-label="">
                      <button
                        type="button"
                        className="linkish"
                        onClick={() => startEdit(m)}
                      >
                        {t.common.edit}
                      </button>
                      {m.isActive ? (
                        <button
                          type="button"
                          className="linkish"
                          onClick={() => void deactivate(m)}
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
