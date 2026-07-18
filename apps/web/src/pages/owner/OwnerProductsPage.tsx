import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import { api, type Product, type ProductionBatch } from "../../lib/api";
import { PRODUCT_PRESETS } from "../../lib/productPresets";
import { getStoredUser } from "../../lib/session";
import { uploadTenantMedia } from "../../lib/tenantUpload";

type ScanResult = {
  product: {
    id: string;
    name: string;
    nameBn: string | null;
    sku: string;
    priceBdt: number;
  };
  batch: ProductionBatch | null;
  unitSerial: string | null;
  unitStatus: string | null;
};

type Props = { locale: LocaleCode };

const emptyForm = {
  presetId: "custom",
  name: "",
  nameBn: "",
  sku: "",
  category: "DRINKING",
  size: "",
  unitCode: "LITER",
  priceBdt: "",
  stockQty: "",
  minStock: "",
  description: "",
};

const PRODUCT_CATEGORIES = [
  "DRINKING",
  "DISTILLED",
  "BATTERY",
  "OTHER",
] as const;

export function OwnerProductsPage({ locale }: Props) {
  const t = getMessages(locale);
  const user = getStoredUser();
  const canWrite = user?.role.code === "OWNER";
  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<
    Array<{ code: string; nameEn: string; nameBn: string }>
  >([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [newUnit, setNewUnit] = useState({
    code: "",
    nameEn: "",
    nameBn: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [autoSkuPreview, setAutoSkuPreview] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [scanQuery, setScanQuery] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  const isCustom = form.presetId === "custom";

  async function refreshAutoSku(category = form.category) {
    try {
      const res = await api.owner.nextProductSku(category);
      setAutoSkuPreview(res.sku);
      if (!editingId) {
        setForm((f) => ({ ...f, sku: res.sku }));
      }
    } catch {
      /* preview optional */
    }
  }

  async function load() {
    const [prod, unitRes] = await Promise.all([
      api.owner.products(),
      api.auth.units(),
    ]);
    setProducts(prod.products);
    setUnits(unitRes.units);
  }

  useEffect(() => {
    startTransition(() => {
      void load()
        .then(() => refreshAutoSku())
        .catch((err) =>
          setError(err instanceof Error ? err.message : "Failed"),
        );
    });
  }, []);

  useEffect(() => {
    if (editingId) return;
    void refreshAutoSku(form.category);
  }, [form.category, editingId]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  function clearImage() {
    setImageFile(null);
    setImagePreview(null);
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setShowAddUnit(false);
    setNewUnit({ code: "", nameEn: "", nameBn: "" });
    clearImage();
    void refreshAutoSku(emptyForm.category);
  }

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
      size: String(preset.size),
      unitCode: preset.unitCode,
    }));
    setShowAddUnit(false);
    void refreshAutoSku(preset.category);
  }

  function startEdit(p: Product) {
    setEditingId(p.id);
    setForm({
      presetId: "custom",
      name: p.name,
      nameBn: p.nameBn ?? "",
      sku: p.sku,
      category: p.category,
      size: p.size == null ? "" : String(p.size),
      unitCode: p.unit ?? "LITER",
      priceBdt: String(p.priceBdt),
      stockQty: String(p.stockQty),
      minStock: String(p.minStock),
      description: p.description ?? "",
    });
    clearImage();
    setShowAddUnit(false);
    setError(null);
    setOkMsg(null);
  }

  async function onAddUnit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const created = await api.owner.createUnit({
        code: newUnit.code.trim().toUpperCase(),
        nameEn: newUnit.nameEn.trim(),
        nameBn: newUnit.nameBn.trim(),
      });
      const unitRes = await api.auth.units();
      setUnits(unitRes.units);
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
    setOkMsg(null);
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
        size: form.size === "" ? null : Number(form.size),
        unitCode: form.unitCode,
        priceBdt: Number(form.priceBdt),
        stockQty: form.stockQty === "" ? 0 : Number(form.stockQty),
        minStock: form.minStock === "" ? 0 : Number(form.minStock),
        description: form.description || null,
      };
      // Create: leave SKU blank → server assigns short ordered code (D001…).
      // Edit: keep existing SKU unless user typed a new one.
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
        setOkMsg(t.owner.productUpdated);
      } else {
        await api.owner.createProduct(body);
        setOkMsg(t.owner.productCreated);
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setUploading(false);
    }
  }

  async function deactivate(id: string) {
    setError(null);
    try {
      await api.owner.deactivateProduct(id);
      if (editingId === id) resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function onProductImage(id: string, file: File | null, sku: string) {
    if (!file) return;
    setError(null);
    setOkMsg(null);
    setUploading(true);
    try {
      const publicId = sku.replace(/[^a-zA-Z0-9_-]/g, "_");
      await uploadTenantMedia({
        file,
        purpose: "products",
        publicId,
        productId: id,
      });
      setOkMsg(t.owner.mediaUploaded);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setUploading(false);
    }
  }

  function formatSizeUnit(p: Product) {
    const unitLabel =
      locale === "bn" && p.unitLabel?.bn
        ? p.unitLabel.bn
        : (p.unitLabel?.en ?? p.unit ?? "");
    if (p.size == null) return unitLabel || "—";
    return unitLabel ? `${p.size} ${unitLabel}` : String(p.size);
  }

  async function applyScan(raw: string) {
    setError(null);
    setOkMsg(null);
    try {
      const res = await api.owner.lookupUnitScan(raw);
      setScanResult({
        product: res.product,
        batch: res.batch,
        unitSerial: res.unit?.serialCode ?? null,
        unitStatus: res.unit?.status ?? null,
      });
      if (!res.batch) {
        setError(t.owner.scanNoBatch.replace("{sku}", res.product.sku));
      } else {
        setOkMsg(
          t.owner.scanProductBatchOk
            .replace("{sku}", res.product.sku)
            .replace("{batch}", res.batch.batchCode),
        );
      }
      setScanQuery("");
    } catch (err) {
      setScanResult(null);
      setError(err instanceof Error ? err.message : "Scan failed");
    }
  }

  return (
    <div className="owner-page">
      <header className="owner-header">
        <div>
          <p className="eyebrow">{t.owner.navProducts}</p>
          <h1>{t.owner.productsTitle}</h1>
          <p className="muted">{t.owner.productsHint}</p>
        </div>
      </header>

      {okMsg ? <p className="ok">{okMsg}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {uploading ? <p className="muted">{t.owner.uploading}</p> : null}

      <div className="owner-form compact scan-bar">
        <label className="full">
          {t.owner.scanUnitLabel}
          <input
            value={scanQuery}
            placeholder={t.owner.scanUnitPlaceholder}
            autoComplete="off"
            onChange={(e) => setScanQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const q = scanQuery.trim();
                if (q) void applyScan(q);
              }
            }}
          />
        </label>
        {scanResult ? (
          <p className="full scan-result-inline">
            <strong>
              {locale === "bn" && scanResult.product.nameBn
                ? scanResult.product.nameBn
                : scanResult.product.name}
            </strong>
            {" · "}
            {scanResult.product.sku}
            {scanResult.batch
              ? ` · ${t.owner.fieldBatch} ${scanResult.batch.batchCode}`
              : ` · ${t.owner.scanNoBatch.replace("{sku}", scanResult.product.sku)}`}
            {" · "}
            <Link
              to={`/owner/batches?productId=${scanResult.product.id}${
                scanResult.batch ? `&batchId=${scanResult.batch.id}` : ""
              }`}
            >
              {t.owner.navBatches}
            </Link>
          </p>
        ) : null}
      </div>

      {!canWrite ? (
        <p className="muted">{t.owner.productsOwnerOnly}</p>
      ) : null}

      {canWrite ? (
        <form className="owner-form compact" onSubmit={onSubmit}>
          {!editingId ? (
            <label>
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
              value={editingId ? form.sku : form.sku || autoSkuPreview}
              readOnly={!editingId}
              onChange={(e) =>
                setForm({ ...form, sku: e.target.value.toUpperCase() })
              }
              placeholder={autoSkuPreview || "MW001"}
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
                  {c === "DRINKING"
                    ? t.owner.catDrinking
                    : c === "DISTILLED"
                      ? t.owner.catDistilled
                      : c === "BATTERY"
                        ? t.owner.catBattery
                        : t.owner.catOther}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.owner.fieldSize}
            <input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              autoComplete="off"
              value={form.size}
              disabled={!isCustom && !editingId}
              placeholder={t.owner.sizeHint}
              onChange={(e) => setForm({ ...form, size: e.target.value })}
            />
          </label>
          <label>
            {t.owner.fieldUnit}
            <select
              value={form.unitCode}
              disabled={!isCustom && !editingId}
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
              placeholder={t.owner.numberRequiredHint}
              onChange={(e) => setForm({ ...form, priceBdt: e.target.value })}
            />
          </label>
          <label>
            {t.owner.fieldStock}
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              autoComplete="off"
              value={form.stockQty}
              placeholder={t.owner.numberZeroIfEmptyHint}
              onChange={(e) => setForm({ ...form, stockQty: e.target.value })}
            />
          </label>
          <label>
            {t.owner.fieldMinStock}
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              autoComplete="off"
              value={form.minStock}
              placeholder={t.owner.numberZeroIfEmptyHint}
              onChange={(e) => setForm({ ...form, minStock: e.target.value })}
            />
            <span className="muted tiny">{t.owner.minStockHint}</span>
          </label>
          <label className="full">
            {t.owner.fieldDescription}
            <input
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </label>

          <div className="full upload-field">
            <span className="upload-field-title">
              {t.owner.fieldProductImage}
            </span>
            <span className="muted tiny">{t.owner.productImageHint}</span>
            {imagePreview ? (
              <img className="product-create-preview" src={imagePreview} alt="" />
            ) : null}
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={(e) => {
                setImageFile(e.target.files?.[0] ?? null);
              }}
            />
            {imageFile ? (
              <button
                type="button"
                className="btn ghost compact"
                onClick={clearImage}
              >
                {t.common.cancel}
              </button>
            ) : null}
          </div>

          <div className="form-actions">
            <button
              className="btn primary"
              type="submit"
              disabled={pending || uploading}
            >
              {editingId ? t.common.save : t.owner.addProduct}
            </button>
            {editingId ? (
              <button
                type="button"
                className="btn ghost"
                onClick={resetForm}
              >
                {t.common.cancel}
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <p className="muted">{t.owner.readOnlyHint}</p>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t.owner.uploadProductImage}</th>
              <th>{t.owner.fieldProductName}</th>
              <th>SKU</th>
              <th>{t.owner.fieldCategory}</th>
              <th>{t.owner.fieldSize}</th>
              <th>{t.owner.fieldPrice}</th>
              <th>{t.owner.fieldStock}</th>
              <th>{t.owner.fieldStatus}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className={p.isActive ? "" : "dim"}>
                <td data-label={t.owner.uploadProductImage}>
                  <div className="product-thumb-cell">
                    {p.imageUrl ? (
                      <img className="product-thumb" src={p.imageUrl} alt="" />
                    ) : (
                      <span className="product-thumb placeholder" />
                    )}
                    {canWrite && p.isActive ? (
                      <label className="upload-field compact">
                        <span className="upload-field-title">
                          {t.owner.chooseImageFile}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          disabled={uploading}
                          onChange={(e) => {
                            void onProductImage(
                              p.id,
                              e.target.files?.[0] ?? null,
                              p.sku,
                            );
                            e.target.value = "";
                          }}
                        />
                      </label>
                    ) : null}
                  </div>
                </td>
                <td data-label={t.owner.fieldProductName}>
                  {locale === "bn" && p.nameBn ? p.nameBn : p.name}
                </td>
                <td data-label="SKU">{p.sku}</td>
                <td data-label={t.owner.fieldCategory}>{p.category}</td>
                <td data-label={t.owner.fieldSize}>{formatSizeUnit(p)}</td>
                <td data-label={t.owner.fieldPrice}>৳{p.priceBdt}</td>
                <td
                  data-label={t.owner.fieldStock}
                  className={p.stockQty <= p.minStock ? "warn" : ""}
                >
                  {p.stockQty}
                </td>
                <td data-label={t.owner.fieldStatus}>
                  {p.isActive ? t.common.online : t.common.offline}
                </td>
                <td className="cell-actions" data-label="">
                  {canWrite && p.isActive ? (
                    <>
                      <button
                        type="button"
                        className="btn ghost compact"
                        onClick={() => startEdit(p)}
                      >
                        {t.common.edit}
                      </button>
                      <button
                        type="button"
                        className="btn ghost compact dark"
                        onClick={() => void deactivate(p.id)}
                      >
                        {t.owner.deactivate}
                      </button>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
