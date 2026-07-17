import { useEffect, useState, useTransition, type FormEvent } from "react";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import { api, type Product, type ProductionBatch } from "../../lib/api";
import { getStoredUser } from "../../lib/session";

type Props = { locale: LocaleCode };

const empty = {
  productId: "",
  batchCode: "",
  manufacturedAt: new Date().toISOString().slice(0, 10),
  expiresAt: "",
  qtyProduced: "",
  note: "",
};

export function OwnerBatchesPage({ locale }: Props) {
  const t = getMessages(locale);
  const user = getStoredUser();
  const canWrite =
    user?.role.code === "OWNER" || user?.role.code === "MANAGER";
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function load() {
    const [prod, batchRes] = await Promise.all([
      api.owner.products(),
      api.owner.batches(),
    ]);
    setProducts(prod.products.filter((p) => p.isActive));
    setBatches(batchRes.batches);
    setForm((f) => ({
      ...f,
      productId: f.productId || prod.products[0]?.id || "",
    }));
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
      await api.owner.createBatch({
        productId: form.productId,
        batchCode: form.batchCode,
        manufacturedAt: form.manufacturedAt,
        expiresAt: form.expiresAt || null,
        qtyProduced: Number(form.qtyProduced),
        note: form.note || null,
        addToStock: true,
      });
      setForm({
        ...empty,
        productId: form.productId,
        manufacturedAt: empty.manufacturedAt,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="owner-page">
      <header className="owner-header">
        <div>
          <p className="eyebrow">{t.owner.navBatches}</p>
          <h1>{t.owner.batchesTitle}</h1>
          <p className="muted">{t.owner.batchesHint}</p>
        </div>
      </header>

      {error ? <p className="error-banner">{error}</p> : null}

      {canWrite ? (
        <form className="owner-form compact" onSubmit={onCreate}>
          <label>
            {t.owner.fieldProduct}
            <select
              required
              value={form.productId}
              onChange={(e) => setForm({ ...form, productId: e.target.value })}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {locale === "bn" && p.nameBn ? p.nameBn : p.name} ({p.sku})
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.owner.fieldBatchCode}
            <input
              required
              placeholder="DW-20L-B2"
              value={form.batchCode}
              onChange={(e) => setForm({ ...form, batchCode: e.target.value })}
            />
          </label>
          <label>
            {t.owner.fieldMfgDate}
            <input
              required
              type="date"
              value={form.manufacturedAt}
              onChange={(e) =>
                setForm({ ...form, manufacturedAt: e.target.value })
              }
            />
          </label>
          <label>
            {t.owner.fieldExpDate}
            <input
              type="date"
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
            />
          </label>
          <label>
            {t.owner.fieldQtyProduced}
            <input
              required
              type="number"
              min={0.01}
              step="0.01"
              value={form.qtyProduced}
              onChange={(e) =>
                setForm({ ...form, qtyProduced: e.target.value })
              }
            />
          </label>
          <label className="full">
            {t.owner.fieldNote}
            <input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </label>
          <button type="submit" className="cta" disabled={pending}>
            {t.owner.addBatch}
          </button>
        </form>
      ) : null}

      <div className="owner-table-wrap">
        <table className="owner-table">
          <thead>
            <tr>
              <th>{t.owner.fieldBatchCode}</th>
              <th>{t.owner.fieldProduct}</th>
              <th>{t.owner.fieldMfgDate}</th>
              <th>{t.owner.fieldExpDate}</th>
              <th>{t.owner.fieldQtyLeft}</th>
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  {t.owner.batchesEmpty}
                </td>
              </tr>
            ) : (
              batches.map((b) => (
                <tr key={b.id}>
                  <td>
                    <strong>{b.batchCode}</strong>
                  </td>
                  <td>
                    {locale === "bn" && b.product?.nameBn
                      ? b.product.nameBn
                      : (b.product?.name ?? "—")}
                    <div className="muted tiny">{b.product?.sku}</div>
                  </td>
                  <td>
                    {new Date(b.manufacturedAt).toLocaleDateString()}
                  </td>
                  <td>
                    {b.expiresAt
                      ? new Date(b.expiresAt).toLocaleDateString()
                      : "—"}
                  </td>
                  <td>
                    {b.qtyRemaining} / {b.qtyProduced}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
