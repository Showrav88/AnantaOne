import { useEffect, useState, useTransition, type FormEvent } from "react";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import { api, type Product } from "../../lib/api";

type Props = { locale: LocaleCode };

const emptyForm = {
  name: "",
  nameBn: "",
  sku: "",
  category: "water",
  unit: "BOTTLE",
  priceBdt: "0",
  stockQty: "0",
  minStock: "0",
  description: "",
};

export function OwnerProductsPage({ locale }: Props) {
  const t = getMessages(locale);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function load() {
    const res = await api.owner.products();
    setProducts(res.products);
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
        unit: form.unit,
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

  return (
    <div className="owner-page">
      <header className="owner-header">
        <div>
          <p className="eyebrow">{t.owner.navProducts}</p>
          <h1>{t.owner.productsTitle}</h1>
          <p className="muted">{t.owner.productsHint}</p>
        </div>
      </header>

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
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
          >
            <option value="BOTTLE">BOTTLE</option>
            <option value="LITER">LITER</option>
            <option value="DRUM">DRUM</option>
            <option value="PIECE">PIECE</option>
            <option value="KG">KG</option>
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

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
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
                <td>{locale === "bn" && p.nameBn ? p.nameBn : p.name}</td>
                <td>{p.sku}</td>
                <td>৳{p.priceBdt}</td>
                <td className={p.stockQty <= p.minStock ? "warn" : ""}>
                  {p.stockQty}
                </td>
                <td>{p.isActive ? t.common.online : t.common.offline}</td>
                <td>
                  {p.isActive ? (
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
