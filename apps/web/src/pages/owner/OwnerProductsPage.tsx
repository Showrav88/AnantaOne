import { useEffect, useState, useTransition, type FormEvent } from "react";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import { api, type Product } from "../../lib/api";
import { getStoredUser } from "../../lib/session";

type Props = { locale: LocaleCode };

const emptyForm = {
  name: "",
  nameBn: "",
  sku: "",
  category: "water",
  unitCode: "BOTTLE",
  priceBdt: "0",
  stockQty: "0",
  minStock: "0",
  description: "",
};

export function OwnerProductsPage({ locale }: Props) {
  const t = getMessages(locale);
  const user = getStoredUser();
  const canWrite = user?.role.code === "OWNER" || user?.role.code === "MANAGER";
  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<
    Array<{ code: string; nameEn: string; nameBn: string }>
  >([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
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

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
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
      await api.owner.deactivateProduct(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function onProductImage(id: string, file: File | null) {
    if (!file) return;
    setError(null);
    try {
      await api.owner.uploadProductImage(id, file);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed");
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
          <div className="form-actions">
            <button className="btn primary" type="submit" disabled={pending}>
              {t.owner.addProduct}
            </button>
            {error ? <span className="error">{error}</span> : null}
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
              <th>{t.owner.fieldPrice}</th>
              <th>{t.owner.fieldStock}</th>
              <th>{t.owner.fieldStatus}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className={p.isActive ? "" : "dim"}>
                <td>
                  <div className="product-thumb-cell">
                    {p.imageUrl ? (
                      <img className="product-thumb" src={p.imageUrl} alt="" />
                    ) : (
                      <span className="product-thumb placeholder" />
                    )}
                    {canWrite && p.isActive ? (
                      <label className="btn ghost compact">
                        {t.owner.uploadProductImage}
                        <input
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={(e) =>
                            void onProductImage(
                              p.id,
                              e.target.files?.[0] ?? null,
                            )
                          }
                        />
                      </label>
                    ) : null}
                  </div>
                </td>
                <td>{locale === "bn" && p.nameBn ? p.nameBn : p.name}</td>
                <td>{p.sku}</td>
                <td>৳{p.priceBdt}</td>
                <td className={p.stockQty <= p.minStock ? "warn" : ""}>
                  {p.stockQty}
                </td>
                <td>{p.isActive ? t.common.online : t.common.offline}</td>
                <td>
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
