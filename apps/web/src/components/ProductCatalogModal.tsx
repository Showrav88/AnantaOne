import { useEffect, useState, type FormEvent } from "react";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import {
  confirmDetails,
  useConfirmAction,
} from "./ConfirmActionDialog";
import {
  api,
  type MaterialRow,
  type Product,
  type ProductBomLine,
} from "../lib/api";
import {
  PRODUCT_CATEGORIES,
  PACK_TYPES,
  categoryLabel,
  packTypeLabel,
} from "../lib/productCatalog";
import { PRODUCT_PRESETS } from "../lib/productPresets";
import { uploadTenantMedia } from "../lib/tenantUpload";
import { ModalPortal } from "./ModalPortal";

const emptyForm = {
  presetId: "custom",
  name: "",
  nameBn: "",
  sku: "",
  category: "DRINKING" as string,
  packType: "BOTTLE" as string,
  innerProductId: "",
  unitsPerPack: "",
  size: "",
  unitCode: "LITER",
  priceBdt: "",
  minStock: "",
  description: "",
  materialsNote: "",
};

type Props = {
  open: boolean;
  locale: LocaleCode;
  product: Product | null;
  products: Product[];
  units: Array<{ code: string; nameEn: string; nameBn: string }>;
  onClose: () => void;
  onSaved: (wasEdit: boolean) => void;
  onUnitsUpdated: (
    units: Array<{ code: string; nameEn: string; nameBn: string }>,
  ) => void;
};

export function ProductCatalogModal({
  open,
  locale,
  product,
  products,
  units,
  onClose,
  onSaved,
  onUnitsUpdated,
}: Props) {
  const t = getMessages(locale);
  const { confirm } = useConfirmAction();
  const editingId = product?.id ?? null;
  const [form, setForm] = useState(emptyForm);
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [newUnit, setNewUnit] = useState({ code: "", nameEn: "", nameBn: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [autoSkuPreview, setAutoSkuPreview] = useState("");
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [bomLines, setBomLines] = useState<
    Array<{ materialId: string; qty: string }>
  >([]);
  const [effectiveBomHint, setEffectiveBomHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const isCustom = form.presetId === "custom";
  const catLabels = {
    catDrinking: t.owner.catDrinking,
    catDistilled: t.owner.catDistilled,
    catBattery: t.owner.catBattery,
    catHandwash: t.owner.catHandwash,
    catDishwash: t.owner.catDishwash,
    catCleaner: t.owner.catCleaner,
    catOther: t.owner.catOther,
  };
  const packLabels = {
    packBottle: t.owner.packBottle,
    packSachet: t.owner.packSachet,
    packJar: t.owner.packJar,
    packBox: t.owner.packBox,
    packOther: t.owner.packOther,
  };

  async function refreshAutoSku(category = form.category) {
    if (editingId) return;
    try {
      const res = await api.owner.nextProductSku(category);
      setAutoSkuPreview(res.sku);
      setForm((f) => ({ ...f, sku: res.sku }));
    } catch {
      /* optional */
    }
  }

  const innerProductOptions = products.filter(
    (p) =>
      p.isActive &&
      p.packType !== "BOX" &&
      p.id !== editingId,
  );

  async function loadBom(productId: string) {
    try {
      const res = await api.owner.productBom(productId);
      setBomLines(
        res.bom.directLines.map((l: ProductBomLine) => ({
          materialId: l.materialId,
          qty: String(l.qty),
        })),
      );
      if (res.bom.effectiveLines.length > 0) {
        setEffectiveBomHint(
          res.bom.effectiveLines
            .map((l: ProductBomLine) => {
              const name =
                locale === "bn" && l.material.nameBn
                  ? l.material.nameBn
                  : l.material.name;
              return `${name} × ${l.qty} ${l.material.unit.code}`;
            })
            .join(" · "),
        );
      } else {
        setEffectiveBomHint(null);
      }
    } catch {
      setBomLines([]);
      setEffectiveBomHint(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    setError(null);
    void api.owner
      .materials(true)
      .then((res: { materials: MaterialRow[] }) => setMaterials(res.materials))
      .catch(() => setMaterials([]));

    if (product) {
      setForm({
        presetId: "custom",
        name: product.name,
        nameBn: product.nameBn ?? "",
        sku: product.sku,
        category: product.category,
        packType: product.packType ?? "BOTTLE",
        innerProductId: product.innerProductId ?? "",
        unitsPerPack:
          product.unitsPerPack != null ? String(product.unitsPerPack) : "",
        size: product.size == null ? "" : String(product.size),
        unitCode: product.unit ?? "LITER",
        priceBdt: String(product.priceBdt),
        minStock: String(product.minStock),
        description: product.description ?? "",
        materialsNote: product.materialsNote ?? "",
      });
      setImagePreview(product.imageUrl ?? null);
      void loadBom(product.id);
    } else {
      setForm(emptyForm);
      setImagePreview(null);
      setBomLines([]);
      setEffectiveBomHint(null);
      void refreshAutoSku(emptyForm.category);
    }
    setImageFile(null);
    setShowAddUnit(false);
  }, [open, product?.id]);

  useEffect(() => {
    if (!open || editingId) return;
    void refreshAutoSku(form.category);
  }, [form.category, open, editingId]);

  useEffect(() => {
    if (!imageFile) {
      if (!product?.imageUrl) setImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile, product?.imageUrl]);

  function applyPreset(presetId: string) {
    if (presetId === "custom") {
      setForm((f) => ({ ...f, presetId: "custom" }));
      return;
    }
    const preset = PRODUCT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setForm((f) => ({
      ...f,
      presetId,
      name: preset.name,
      nameBn: preset.nameBn,
      sku: "",
      category: preset.category,
      packType: preset.packType,
      size: String(preset.size),
      unitCode: preset.unitCode,
    }));
    void refreshAutoSku(preset.category);
  }

  async function onAddUnit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const decision = await confirm({
      title: t.common.confirmCreateTitle,
      message: t.common.confirmCreateMessage,
      tone: "create",
      confirmLabel: t.common.confirmCreate,
      cancelLabel: t.common.cancel,
      details: confirmDetails(
        [
          {
            label: t.owner.fieldUnitCode,
            value: newUnit.code.trim().toUpperCase(),
          },
          { label: t.owner.fieldProductName, value: newUnit.nameEn.trim() },
          { label: t.owner.fieldProductNameBn, value: newUnit.nameBn.trim() },
        ],
        { skipEmpty: true },
      ),
    });
    if (!decision.ok) return;
    try {
      const created = await api.owner.createUnit({
        code: newUnit.code.trim().toUpperCase(),
        nameEn: newUnit.nameEn.trim(),
        nameBn: newUnit.nameBn.trim(),
      });
      const unitRes = await api.auth.units();
      onUnitsUpdated(unitRes.units);
      setForm((f) => ({ ...f, unitCode: created.unit.code }));
      setNewUnit({ code: "", nameEn: "", nameBn: "" });
      setShowAddUnit(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const skuPreview =
      editingId || form.sku.trim().length >= 2
        ? editingId
          ? form.sku
          : form.sku.trim().toUpperCase()
        : t.common.autoAssigned;
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
          { label: t.owner.fieldSku, value: skuPreview },
          { label: t.owner.fieldProductName, value: form.name },
          { label: t.owner.fieldCategory, value: categoryLabel(form.category, catLabels) },
          { label: t.owner.fieldPackType, value: packTypeLabel(form.packType, packLabels) },
          {
            label: t.owner.fieldSize,
            value:
              form.size === "" ? "—" : `${form.size} ${form.unitCode}`,
          },
          { label: t.owner.fieldPrice, value: `৳${Number(form.priceBdt || 0)}` },
          { label: t.owner.fieldMaterialsNote, value: form.materialsNote },
          {
            label: t.owner.fieldProductImage,
            value: imageFile ? imageFile.name : undefined,
          },
        ],
        { skipEmpty: true },
      ),
    });
    if (!decision.ok) return;

    setUploading(true);
    try {
      let imageUrl: string | null | undefined;
      let imagePublicId: string | null | undefined;

      if (imageFile) {
        const publicId = form.sku.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
        const { uploaded } = await uploadTenantMedia({
          file: imageFile,
          purpose: "products",
          publicId,
          label: form.name,
          ...(editingId ? { productId: editingId } : {}),
        });
        imageUrl = uploaded.url;
        imagePublicId = uploaded.publicId;
      }

      const body: Record<string, unknown> = {
        name: form.name,
        nameBn: form.nameBn || null,
        category: form.category,
        packType: form.packType,
        innerProductId:
          form.packType === "BOX" && form.innerProductId
            ? form.innerProductId
            : null,
        unitsPerPack:
          form.packType === "BOX" && form.unitsPerPack.trim()
            ? Number(form.unitsPerPack)
            : null,
        size: form.size === "" ? null : Number(form.size),
        unitCode: form.packType === "BOX" ? "PIECE" : form.unitCode,
        priceBdt: Number(form.priceBdt),
        minStock: form.minStock === "" ? 0 : Number(form.minStock),
        description: form.description || null,
        materialsNote: form.materialsNote.trim() || null,
        bomLines: bomLines
          .filter((l) => l.materialId && Number(l.qty) > 0)
          .map((l) => ({ materialId: l.materialId, qty: Number(l.qty) })),
      };
      if (editingId) {
        body.sku = form.sku;
      } else if (form.sku.trim().length >= 2) {
        body.sku = form.sku.trim().toUpperCase();
      }
      if (imageUrl !== undefined) {
        body.imageUrl = imageUrl;
        body.imagePublicId = imagePublicId;
      }

      if (editingId) {
        await api.owner.updateProduct(editingId, body);
      } else {
        await api.owner.createProduct(body);
      }
      onSaved(!!editingId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setUploading(false);
    }
  }

  if (!open) return null;

  return (
    <ModalPortal>
      <div
        className="owner-dialog-backdrop"
        role="presentation"
        onClick={onClose}
      >
      <div
        className="owner-dialog catalog-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="owner-dialog-head">
          <div>
            <h2 id="catalog-modal-title">
              {editingId ? t.owner.editProduct : t.owner.addProduct}
            </h2>
            <p className="muted tiny">{t.owner.catalogModalHint}</p>
          </div>
          <button type="button" className="btn ghost compact" onClick={onClose}>
            {t.common.close}
          </button>
        </header>

        {error ? <p className="error">{error}</p> : null}

        <form className="owner-form compact catalog-modal-form" onSubmit={onSubmit}>
          {!editingId ? (
            <label className="full">
              {t.owner.productPreset}
              <select
                value={form.presetId}
                onChange={(e) => applyPreset(e.target.value)}
              >
                <option value="custom">{t.owner.productPresetCustom}</option>
                {PRODUCT_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {locale === "bn" ? p.nameBn : p.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label>
            {t.owner.fieldProductName}
            <input
              required
              value={form.name}
              disabled={!isCustom && !editingId}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            {t.owner.fieldProductNameBn}
            <input
              value={form.nameBn}
              disabled={!isCustom && !editingId}
              onChange={(e) => setForm({ ...form, nameBn: e.target.value })}
            />
          </label>
          <label>
            {t.owner.fieldSku}
            <input
              className="sku-field"
              value={editingId ? form.sku : form.sku || autoSkuPreview}
              readOnly={!editingId}
              onChange={(e) =>
                setForm({ ...form, sku: e.target.value.toUpperCase() })
              }
            />
          </label>
          <label>
            {t.owner.fieldCategory}
            <select
              value={form.category}
              disabled={!isCustom && !editingId}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c, catLabels)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.owner.fieldPackType}
            <select
              value={form.packType}
              onChange={(e) => {
                const packType = e.target.value;
                setForm({
                  ...form,
                  packType,
                  unitCode: packType === "BOX" ? "PIECE" : form.unitCode,
                  innerProductId: packType === "BOX" ? form.innerProductId : "",
                  unitsPerPack: packType === "BOX" ? form.unitsPerPack : "",
                });
              }}
            >
              {PACK_TYPES.map((p) => (
                <option key={p} value={p}>
                  {packTypeLabel(p, packLabels)}
                </option>
              ))}
            </select>
          </label>

          {form.packType === "BOX" ? (
            <>
              <label>
                {t.owner.fieldInnerProduct}
                <select
                  value={form.innerProductId}
                  onChange={(e) =>
                    setForm({ ...form, innerProductId: e.target.value })
                  }
                >
                  <option value="">{t.owner.innerProductNone}</option>
                  {innerProductOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} ·{" "}
                      {locale === "bn" && p.nameBn ? p.nameBn : p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t.owner.fieldUnitsPerPack}
                <input
                  type="number"
                  min={1}
                  step={1}
                  required
                  inputMode="numeric"
                  value={form.unitsPerPack}
                  placeholder="24"
                  onChange={(e) =>
                    setForm({ ...form, unitsPerPack: e.target.value })
                  }
                />
              </label>
              <p className="muted tiny full">{t.owner.boxPackHint}</p>
            </>
          ) : null}

          <label>
            {t.owner.fieldSize}
            <input
              type="number"
              min="0.0001"
              step="any"
              inputMode="decimal"
              autoComplete="off"
              value={form.size}
              disabled={!isCustom && !editingId}
              placeholder={t.owner.sizeRangeHint}
              onChange={(e) => setForm({ ...form, size: e.target.value })}
            />
          </label>
          <label>
            {t.owner.fieldUnit}
            <select
              value={form.unitCode}
              disabled={!isCustom && !editingId || form.packType === "BOX"}
              onChange={(e) => setForm({ ...form, unitCode: e.target.value })}
            >
              {units.map((u) => (
                <option key={u.code} value={u.code}>
                  {locale === "bn" ? u.nameBn : u.nameEn}
                </option>
              ))}
            </select>
          </label>

          {isCustom || editingId ? (
            <div className="full">
              {!showAddUnit ? (
                <button
                  type="button"
                  className="btn ghost compact"
                  onClick={() => setShowAddUnit(true)}
                >
                  {t.owner.addUnit}
                </button>
              ) : (
                <div className="owner-form compact inline-unit-form">
                  <label>
                    {t.owner.fieldUnitCode}
                    <input
                      required
                      value={newUnit.code}
                      onChange={(e) =>
                        setNewUnit({ ...newUnit, code: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    {t.owner.unitNameEn}
                    <input
                      required
                      value={newUnit.nameEn}
                      onChange={(e) =>
                        setNewUnit({ ...newUnit, nameEn: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    {t.owner.unitNameBn}
                    <input
                      required
                      value={newUnit.nameBn}
                      onChange={(e) =>
                        setNewUnit({ ...newUnit, nameBn: e.target.value })
                      }
                    />
                  </label>
                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn primary compact"
                      onClick={(e) => void onAddUnit(e)}
                    >
                      {t.owner.addUnit}
                    </button>
                    <button
                      type="button"
                      className="btn ghost compact"
                      onClick={() => {
                        setShowAddUnit(false);
                        setNewUnit({ code: "", nameEn: "", nameBn: "" });
                      }}
                    >
                      {t.common.cancel}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <label>
            {t.owner.fieldPrice}
            <input
              type="number"
              min="0"
              step="0.01"
              required
              inputMode="decimal"
              autoComplete="off"
              value={form.priceBdt}
              onChange={(e) => setForm({ ...form, priceBdt: e.target.value })}
            />
          </label>
          <label>
            {t.owner.fieldMinStock}
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={form.minStock}
              onChange={(e) => setForm({ ...form, minStock: e.target.value })}
            />
          </label>
          <p className="muted tiny full">{t.owner.stockFromBatchesHint}</p>

          <fieldset className="full bom-editor">
            <legend>{t.owner.fieldBom}</legend>
            <p className="muted tiny">{t.owner.bomPerUnitHint}</p>
            {bomLines.length === 0 ? (
              <p className="muted tiny">{t.owner.bomEmpty}</p>
            ) : (
              <ul className="plain-list bom-lines">
                {bomLines.map((line, idx) => (
                  <li key={idx} className="bom-line-row">
                    <select
                      value={line.materialId}
                      onChange={(e) => {
                        const next = [...bomLines];
                        next[idx] = { ...line, materialId: e.target.value };
                        setBomLines(next);
                      }}
                    >
                      <option value="">{t.owner.bomPickMaterial}</option>
                      {materials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.code ? `${m.code} · ` : ""}
                          {locale === "bn" && m.nameBn ? m.nameBn : m.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0.000001}
                      step="any"
                      placeholder={t.owner.fieldQty}
                      value={line.qty}
                      onChange={(e) => {
                        const next = [...bomLines];
                        next[idx] = { ...line, qty: e.target.value };
                        setBomLines(next);
                      }}
                    />
                    <button
                      type="button"
                      className="linkish"
                      onClick={() =>
                        setBomLines(bomLines.filter((_, i) => i !== idx))
                      }
                    >
                      {t.common.delete}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className="btn ghost compact"
              onClick={() =>
                setBomLines([...bomLines, { materialId: "", qty: "" }])
              }
            >
              {t.owner.bomAddLine}
            </button>
            {form.packType === "BOX" && form.innerProductId ? (
              <p className="muted tiny">{t.owner.bomBoxInnerHint}</p>
            ) : null}
            {effectiveBomHint ? (
              <p className="muted tiny">
                {t.owner.bomEffective}: {effectiveBomHint}
              </p>
            ) : null}
          </fieldset>

          <label className="full">
            {t.owner.fieldDescription}
            <input
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </label>
          <label className="full">
            {t.owner.fieldMaterialsNote}
            <textarea
              rows={3}
              value={form.materialsNote}
              placeholder={t.owner.materialsNoteHint}
              onChange={(e) =>
                setForm({ ...form, materialsNote: e.target.value })
              }
            />
          </label>

          <div className="full upload-field">
            <span className="upload-field-title">{t.owner.fieldProductImage}</span>
            {imagePreview ? (
              <img className="product-create-preview" src={imagePreview} alt="" />
            ) : null}
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="form-actions full">
            <button className="btn primary" type="submit" disabled={uploading}>
              {editingId ? t.common.save : t.owner.addProduct}
            </button>
            <button type="button" className="btn ghost" onClick={onClose}>
              {t.common.cancel}
            </button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
}
