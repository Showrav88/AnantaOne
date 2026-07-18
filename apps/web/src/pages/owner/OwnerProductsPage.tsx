import { useEffect, useState, useTransition, type FormEvent } from "react";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import { api, type Product } from "../../lib/api";
import { getStoredUser } from "../../lib/session";
import { uploadTenantMedia } from "../../lib/tenantUpload";

type Props = { locale: LocaleCode };

const emptyForm = {
  name: "",
  nameBn: "",
  sku: "",
  category: "DRINKING",
  unitCode: "BOTTLE",
  priceBdt: "0",
  stockQty: "0",
  minStock: "0",
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

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
      void load().catch((err) =>
        setError(err instanceof Error ? err.message : "Failed"),
      );
    });
  }, []);

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

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);
    setUploading(true);
    try {
      let imageUrl: string | null = null;
      let imagePublicId: string | null = null;

      if (imageFile) {
        const publicId = form.sku.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
        const { uploaded } = await uploadTenantMedia({
          file: imageFile,
          purpose: "products",
          publicId,
          label: form.name,
        });
        imageUrl = uploaded.url;
        imagePublicId = uploaded.publicId;
      }

      await api.owner.createProduct({
        name: form.name,
        nameBn: form.nameBn || null,
        sku: form.sku,
        category: form.category,
        unitCode: form.unitCode,
        priceBdt: Number(form.priceBdt),
        stockQty: Number(form.stockQty),
        minStock: Number(form.minStock),
        description: form.description || null,
        imageUrl,
        imagePublicId,
      });
      setForm(emptyForm);
      clearImage();
      setOkMsg(t.owner.productCreated);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setUploading(false);
    }
  }

  async function deactivate(id: string) {
    setError(null);
    try {
      await api.owner.deactivateProduct(id);
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

      {!canWrite ? (
        <p className="muted">{t.owner.productsOwnerOnly}</p>
      ) : null}

      {canWrite ? (
        <form className="owner-form compact" onSubmit={onCreate}>
          <label>
            {t.owner.fieldProductName}
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            {t.owner.fieldProductNameBn}
            <input
              value={form.nameBn}
              onChange={(e) => setForm({ ...form, nameBn: e.target.value })}
            />
          </label>
          <label>
            SKU
            <input
              required
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
            />
          </label>
          <label>
            {t.owner.fieldCategory}
            <select
              value={form.category}
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
            {t.owner.fieldUnit}
            <select
              value={form.unitCode}
              onChange={(e) => setForm({ ...form, unitCode: e.target.value })}
            >
              {units.map((u) => (
                <option key={u.code} value={u.code}>
                  {locale === "bn" ? u.nameBn : u.nameEn}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.owner.fieldPrice}
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={form.priceBdt}
              onChange={(e) => setForm({ ...form, priceBdt: e.target.value })}
            />
          </label>
          <label>
            {t.owner.fieldStock}
            <input
              type="number"
              min="0"
              step="1"
              value={form.stockQty}
              onChange={(e) => setForm({ ...form, stockQty: e.target.value })}
            />
          </label>
          <label>
            {t.owner.fieldMinStock}
            <input
              type="number"
              min="0"
              step="1"
              value={form.minStock}
              onChange={(e) => setForm({ ...form, minStock: e.target.value })}
            />
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
              {t.owner.addProduct}
            </button>
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
                    <button
                      type="button"
                      className="btn ghost compact dark"
                      onClick={() => void deactivate(p.id)}
                    >
                      {t.owner.deactivate}
                    </button>
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
