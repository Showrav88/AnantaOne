import { useEffect, useState, useTransition, type FormEvent } from "react";
import QRCode from "qrcode";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import {
  api,
  type Product,
  type ProductionBatch,
  type TagPreview,
  type TagTemplate,
} from "../../lib/api";
import { getStoredUser } from "../../lib/session";

type Props = { locale: LocaleCode };

const emptyTpl = {
  name: "",
  widthMm: "50",
  heightMm: "30",
  tagDescription: "",
  showSku: true,
  showPrice: true,
  showDescription: true,
  showMfgDate: true,
  showExpDate: true,
  showBatch: true,
  showQr: true,
  showCompany: true,
  isDefault: true,
};

export function OwnerTagsPage({ locale }: Props) {
  const t = getMessages(locale);
  const user = getStoredUser();
  const canWrite =
    user?.role.code === "OWNER" || user?.role.code === "MANAGER";

  const [templates, setTemplates] = useState<TagTemplate[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [form, setForm] = useState(emptyTpl);
  const [productId, setProductId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [preview, setPreview] = useState<TagPreview | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function load() {
    const [tpl, prod, batchRes] = await Promise.all([
      api.owner.tagTemplates(),
      api.owner.products(),
      api.owner.batches(),
    ]);
    setTemplates(tpl.templates);
    setProducts(prod.products.filter((p) => p.isActive));
    setBatches(batchRes.batches);
    const firstProd = prod.products[0];
    if (firstProd) setProductId((id) => id || firstProd.id);
    const def = tpl.templates.find((x) => x.isDefault) ?? tpl.templates[0];
    if (def) setTemplateId((id) => id || def.id);
  }

  useEffect(() => {
    startTransition(() => {
      void load().catch((err) =>
        setError(err instanceof Error ? err.message : "Failed"),
      );
    });
  }, []);

  const productBatches = batches.filter((b) => b.productId === productId);

  useEffect(() => {
    if (productBatches[0]) setBatchId(productBatches[0].id);
    else setBatchId("");
  }, [productId, batches]);

  async function onCreateTemplate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.owner.createTagTemplate({
        name: form.name,
        widthMm: Number(form.widthMm),
        heightMm: Number(form.heightMm),
        tagDescription: form.tagDescription || null,
        showSku: form.showSku,
        showPrice: form.showPrice,
        showDescription: form.showDescription,
        showMfgDate: form.showMfgDate,
        showExpDate: form.showExpDate,
        showBatch: form.showBatch,
        showQr: form.showQr,
        showCompany: form.showCompany,
        isDefault: form.isDefault,
      });
      setForm(emptyTpl);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function onPreview() {
    setError(null);
    try {
      const res = await api.owner.previewTag({
        productId,
        batchId,
        templateId: templateId || undefined,
      });
      setPreview(res.tag);
      if (res.tag.fields.qrValue) {
        const url = await QRCode.toDataURL(res.tag.fields.qrValue, {
          margin: 1,
          width: 160,
        });
        setQrDataUrl(url);
      } else {
        setQrDataUrl(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  function printTag() {
    window.print();
  }

  const mmToPx = (mm: number) => Math.round((mm / 25.4) * 96);

  return (
    <div className="owner-page">
      <header className="owner-header">
        <div>
          <p className="eyebrow">{t.owner.navTags}</p>
          <h1>{t.owner.tagsTitle}</h1>
          <p className="muted">{t.owner.tagsHint}</p>
        </div>
      </header>

      {error ? <p className="error-banner">{error}</p> : null}

      <div className="wallet-forms">
        {canWrite ? (
          <form className="owner-form compact" onSubmit={onCreateTemplate}>
            <h2>{t.owner.tagTemplateForm}</h2>
            <label>
              {t.owner.fieldTemplateName}
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              {t.owner.fieldWidthMm}
              <input
                type="number"
                min={20}
                max={200}
                value={form.widthMm}
                onChange={(e) => setForm({ ...form, widthMm: e.target.value })}
              />
            </label>
            <label>
              {t.owner.fieldHeightMm}
              <input
                type="number"
                min={15}
                max={200}
                value={form.heightMm}
                onChange={(e) => setForm({ ...form, heightMm: e.target.value })}
              />
            </label>
            <label className="full">
              {t.owner.fieldTagDescription}
              <input
                value={form.tagDescription}
                onChange={(e) =>
                  setForm({ ...form, tagDescription: e.target.value })
                }
                placeholder={t.owner.tagDescHint}
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={form.showSku}
                onChange={(e) =>
                  setForm({ ...form, showSku: e.target.checked })
                }
              />
              SKU
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={form.showPrice}
                onChange={(e) =>
                  setForm({ ...form, showPrice: e.target.checked })
                }
              />
              {t.owner.fieldPrice}
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={form.showDescription}
                onChange={(e) =>
                  setForm({ ...form, showDescription: e.target.checked })
                }
              />
              {t.owner.fieldDescription}
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={form.showMfgDate}
                onChange={(e) =>
                  setForm({ ...form, showMfgDate: e.target.checked })
                }
              />
              {t.owner.fieldMfgDate}
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={form.showExpDate}
                onChange={(e) =>
                  setForm({ ...form, showExpDate: e.target.checked })
                }
              />
              {t.owner.fieldExpDate}
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={form.showBatch}
                onChange={(e) =>
                  setForm({ ...form, showBatch: e.target.checked })
                }
              />
              Batch
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={form.showQr}
                onChange={(e) =>
                  setForm({ ...form, showQr: e.target.checked })
                }
              />
              QR
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) =>
                  setForm({ ...form, isDefault: e.target.checked })
                }
              />
              {t.owner.fieldDefault}
            </label>
            <button type="submit" className="cta" disabled={pending}>
              {t.owner.saveTemplate}
            </button>
          </form>
        ) : null}

        <div className="owner-form compact">
          <h2>{t.owner.printPreview}</h2>
          <label>
            {t.owner.fieldTemplate}
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name} ({tpl.widthMm}×{tpl.heightMm}mm)
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.owner.fieldProduct}
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {locale === "bn" && p.nameBn ? p.nameBn : p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.owner.fieldBatch}
            <select
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
            >
              {productBatches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.batchCode}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="cta"
            onClick={() => void onPreview()}
            disabled={!productId || !batchId}
          >
            {t.owner.previewTag}
          </button>
          {preview ? (
            <button type="button" className="cta secondary" onClick={printTag}>
              {t.owner.printTag}
            </button>
          ) : null}
        </div>
      </div>

      {preview ? (
        <div className="tag-print-area">
          <div
            className="product-tag"
            style={{
              width: mmToPx(preview.size.widthMm),
              minHeight: mmToPx(preview.size.heightMm),
            }}
          >
            {preview.fields.company ? (
              <p className="tag-brand">{preview.fields.company}</p>
            ) : null}
            <p className="tag-name">{preview.fields.productName}</p>
            {preview.fields.sku ? (
              <p className="tag-row">SKU: {preview.fields.sku}</p>
            ) : null}
            {preview.fields.priceBdt != null ? (
              <p className="tag-price">৳{preview.fields.priceBdt}</p>
            ) : null}
            {preview.fields.description ? (
              <p className="tag-desc">{preview.fields.description}</p>
            ) : null}
            {preview.fields.batchCode ? (
              <p className="tag-row">Batch: {preview.fields.batchCode}</p>
            ) : null}
            {preview.fields.manufacturedAt ? (
              <p className="tag-row">
                MFG:{" "}
                {new Date(preview.fields.manufacturedAt).toLocaleDateString()}
              </p>
            ) : null}
            {preview.fields.expiresAt ? (
              <p className="tag-row">
                EXP: {new Date(preview.fields.expiresAt).toLocaleDateString()}
              </p>
            ) : null}
            {qrDataUrl ? (
              <img className="tag-qr" src={qrDataUrl} alt="QR" />
            ) : null}
          </div>
        </div>
      ) : null}

      <h2 className="section-title">{t.owner.savedTemplates}</h2>
      <ul className="plain-list">
        {templates.map((tpl) => (
          <li key={tpl.id}>
            <span>
              {tpl.name}
              {tpl.isDefault ? " ★" : ""}
              <div className="muted tiny">
                {tpl.widthMm}×{tpl.heightMm}mm
              </div>
            </span>
            <span className="muted tiny">
              {[
                tpl.showSku && "SKU",
                tpl.showPrice && "৳",
                tpl.showQr && "QR",
                tpl.showExpDate && "EXP",
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
