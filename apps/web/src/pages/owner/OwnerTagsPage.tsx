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

const SIZE_PRESETS = [
  { label: "40×25", w: 40, h: 25 },
  { label: "50×30", w: 50, h: 30 },
  { label: "60×40", w: 60, h: 40 },
  { label: "80×50", w: 80, h: 50 },
  { label: "100×70", w: 100, h: 70 },
] as const;

function toDateInput(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

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
  const [mfgDate, setMfgDate] = useState("");
  const [expDate, setExpDate] = useState("");
  const [printWidth, setPrintWidth] = useState("50");
  const [printHeight, setPrintHeight] = useState("30");
  const [saveDates, setSaveDates] = useState(true);
  const [preview, setPreview] = useState<TagPreview | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
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
    if (def) {
      setTemplateId((id) => id || def.id);
      setPrintWidth(String(def.widthMm));
      setPrintHeight(String(def.heightMm));
    }
    return batchRes.batches;
  }

  useEffect(() => {
    startTransition(() => {
      void load().catch((err) =>
        setError(err instanceof Error ? err.message : "Failed"),
      );
    });
  }, []);

  const productBatches = batches.filter((b) => b.productId === productId);
  const selectedBatch = productBatches.find((b) => b.id === batchId);

  useEffect(() => {
    if (productBatches[0]) setBatchId(productBatches[0].id);
    else setBatchId("");
  }, [productId, batches]);

  useEffect(() => {
    if (!selectedBatch) {
      setMfgDate("");
      setExpDate("");
      return;
    }
    setMfgDate(toDateInput(selectedBatch.manufacturedAt));
    setExpDate(toDateInput(selectedBatch.expiresAt));
  }, [batchId, selectedBatch?.id, selectedBatch?.manufacturedAt, selectedBatch?.expiresAt]);

  useEffect(() => {
    const tpl = templates.find((x) => x.id === templateId);
    if (tpl) {
      setPrintWidth(String(tpl.widthMm));
      setPrintHeight(String(tpl.heightMm));
    }
  }, [templateId, templates]);

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

  async function onSaveDatesOnly() {
    if (!batchId || !mfgDate) return;
    setError(null);
    setOkMsg(null);
    try {
      await api.owner.updateBatch(batchId, {
        manufacturedAt: mfgDate,
        expiresAt: expDate || null,
      });
      setOkMsg(t.owner.datesSaved);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function onPreview() {
    setError(null);
    setOkMsg(null);
    try {
      const res = await api.owner.previewTag({
        productId,
        batchId,
        templateId: templateId || undefined,
        manufacturedAt: mfgDate || undefined,
        expiresAt: expDate || null,
        saveDatesToBatch: saveDates,
        widthMm: Number(printWidth),
        heightMm: Number(printHeight),
      });
      setPreview(res.tag);
      if (saveDates) {
        setOkMsg(t.owner.datesSaved);
        await load();
      }
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
      {okMsg ? <p className="ok-banner">{okMsg}</p> : null}

      <div className="responsive-panels">
        <section className="panel-card">
          <h2>{t.owner.printPreview}</h2>
          <p className="muted tiny">{t.owner.tagDateHint}</p>
          <div className="owner-form compact">
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
                    {p.sku} —{" "}
                    {locale === "bn" && p.nameBn ? p.nameBn : p.name}
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
            <label>
              {t.owner.fieldMfgDate}
              <input
                type="date"
                required
                value={mfgDate}
                onChange={(e) => setMfgDate(e.target.value)}
              />
            </label>
            <label>
              {t.owner.fieldExpDate}
              <input
                type="date"
                value={expDate}
                onChange={(e) => setExpDate(e.target.value)}
              />
            </label>
            <label className="full">
              {t.owner.tagPrintSize}
              <div className="size-presets">
                {SIZE_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    className={
                      Number(printWidth) === p.w && Number(printHeight) === p.h
                        ? "size-chip active"
                        : "size-chip"
                    }
                    onClick={() => {
                      setPrintWidth(String(p.w));
                      setPrintHeight(String(p.h));
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </label>
            <label>
              {t.owner.fieldWidthMm}
              <input
                type="number"
                min={20}
                max={200}
                value={printWidth}
                onChange={(e) => setPrintWidth(e.target.value)}
              />
            </label>
            <label>
              {t.owner.fieldHeightMm}
              <input
                type="number"
                min={15}
                max={200}
                value={printHeight}
                onChange={(e) => setPrintHeight(e.target.value)}
              />
            </label>
            {canWrite ? (
              <label className="check full">
                <input
                  type="checkbox"
                  checked={saveDates}
                  onChange={(e) => setSaveDates(e.target.checked)}
                />
                {t.owner.saveDatesToBatch}
              </label>
            ) : null}
            <button
              type="button"
              className="cta"
              onClick={() => void onPreview()}
              disabled={!productId || !batchId || !mfgDate}
            >
              {t.owner.previewTag}
            </button>
            {canWrite ? (
              <button
                type="button"
                className="cta secondary"
                onClick={() => void onSaveDatesOnly()}
                disabled={!batchId || !mfgDate}
              >
                {t.owner.saveDatesOnly}
              </button>
            ) : null}
            {preview ? (
              <button
                type="button"
                className="cta secondary"
                onClick={() => window.print()}
              >
                {t.owner.printTag}
              </button>
            ) : null}
          </div>
        </section>

        {canWrite ? (
          <section className="panel-card">
            <h2>{t.owner.tagTemplateForm}</h2>
            <form className="owner-form compact" onSubmit={onCreateTemplate}>
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
                  onChange={(e) =>
                    setForm({ ...form, widthMm: e.target.value })
                  }
                />
              </label>
              <label>
                {t.owner.fieldHeightMm}
                <input
                  type="number"
                  min={15}
                  max={200}
                  value={form.heightMm}
                  onChange={(e) =>
                    setForm({ ...form, heightMm: e.target.value })
                  }
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
          </section>
        ) : null}
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
