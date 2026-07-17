import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import QRCode from "qrcode";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import {
  api,
  type Product,
  type ProductionBatch,
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

function formatTagDate(value: string) {
  if (!value) return "—";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

export function OwnerTagsPage({ locale }: Props) {
  const t = getMessages(locale);
  const user = getStoredUser();
  const canWrite =
    user?.role.code === "OWNER" || user?.role.code === "MANAGER";

  const [templates, setTemplates] = useState<TagTemplate[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [company, setCompany] = useState<{
    name: string;
    slug: string;
    phone: string | null;
  } | null>(null);
  const [form, setForm] = useState(emptyTpl);
  const [productId, setProductId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [mfgDate, setMfgDate] = useState("");
  const [expDate, setExpDate] = useState("");
  const [printWidth, setPrintWidth] = useState("50");
  const [printHeight, setPrintHeight] = useState("30");
  const [saveDates, setSaveDates] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingDates, setSavingDates] = useState(false);
  const [pending, startTransition] = useTransition();
  const lastProductId = useRef("");

  async function load() {
    const [tpl, prod, batchRes, companyRes] = await Promise.all([
      api.owner.tagTemplates(),
      api.owner.products(),
      api.owner.batches(),
      api.owner.company().catch(() => null),
    ]);
    setTemplates(tpl.templates);
    setProducts(prod.products.filter((p) => p.isActive));
    setBatches(batchRes.batches);
    if (companyRes?.company) {
      setCompany({
        name: companyRes.company.name,
        slug: companyRes.company.slug,
        phone: companyRes.company.phone ?? null,
      });
    }
    const firstProd = prod.products.find((p) => p.isActive) ?? prod.products[0];
    if (firstProd) setProductId((id) => id || firstProd.id);
    const def = tpl.templates.find((x) => x.isDefault) ?? tpl.templates[0];
    if (def) {
      setTemplateId((id) => id || def.id);
      setPrintWidth((w) => (w ? w : String(def.widthMm)));
      setPrintHeight((h) => (h ? h : String(def.heightMm)));
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

  const productBatches = useMemo(
    () => batches.filter((b) => b.productId === productId),
    [batches, productId],
  );
  const selectedProduct = products.find((p) => p.id === productId);
  const selectedBatch = batches.find((b) => b.id === batchId);
  const selectedTemplate = templates.find((x) => x.id === templateId);
  const productCreatedMin = selectedProduct?.createdAt
    ? toDateInput(selectedProduct.createdAt)
    : "";

  // Only reset batch when the product changes — not when batches reload after save.
  useEffect(() => {
    if (productId === lastProductId.current) {
      if (batchId && productBatches.some((b) => b.id === batchId)) return;
      if (productBatches[0]) setBatchId(productBatches[0].id);
      else setBatchId("");
      return;
    }
    lastProductId.current = productId;
    if (productBatches[0]) setBatchId(productBatches[0].id);
    else setBatchId("");
  }, [productId, productBatches, batchId]);

  // MFG defaults from product create date when product changes; EXP blank until set.
  useEffect(() => {
    if (!selectedProduct?.createdAt) {
      setMfgDate("");
      setExpDate("");
      return;
    }
    setMfgDate(toDateInput(selectedProduct.createdAt));
    setExpDate("");
  }, [productId, selectedProduct?.createdAt]);

  useEffect(() => {
    const tpl = templates.find((x) => x.id === templateId);
    if (tpl) {
      setPrintWidth(String(tpl.widthMm));
      setPrintHeight(String(tpl.heightMm));
    }
  }, [templateId, templates]);

  const liveTag = useMemo(() => {
    if (!selectedProduct) return null;
    const tpl = selectedTemplate ?? {
      showSku: true,
      showPrice: true,
      showDescription: true,
      showMfgDate: true,
      showExpDate: true,
      showBatch: true,
      showQr: true,
      showCompany: true,
      tagDescription: null as string | null,
    };
    const widthMm = Number(printWidth) || 50;
    const heightMm = Number(printHeight) || 30;
    const productName =
      locale === "bn" && selectedProduct.nameBn
        ? selectedProduct.nameBn
        : selectedProduct.name;
    const description =
      tpl.tagDescription?.trim() ||
      selectedProduct.description ||
      selectedProduct.nameBn ||
      selectedProduct.name;
    const qrValue =
      tpl.showQr && company?.slug && selectedBatch
        ? `${window.location.origin}${window.location.pathname}#/tag/${company.slug}/${encodeURIComponent(selectedProduct.sku)}/${encodeURIComponent(selectedBatch.batchCode)}`
        : null;

    return {
      size: { widthMm, heightMm },
      fields: {
        company: tpl.showCompany ? (company?.name ?? null) : null,
        phone: tpl.showCompany ? (company?.phone ?? null) : null,
        productName,
        sku: tpl.showSku ? selectedProduct.sku : null,
        priceBdt: tpl.showPrice ? selectedProduct.priceBdt : null,
        description: tpl.showDescription ? description : null,
        batchCode: tpl.showBatch ? (selectedBatch?.batchCode ?? null) : null,
        manufacturedAt: tpl.showMfgDate && mfgDate ? mfgDate : null,
        expiresAt: tpl.showExpDate && expDate ? expDate : null,
        qrValue,
      },
    };
  }, [
    selectedProduct,
    selectedBatch,
    selectedTemplate,
    company,
    printWidth,
    printHeight,
    mfgDate,
    expDate,
    locale,
  ]);

  // Live QR for the current tag fields.
  useEffect(() => {
    const value = liveTag?.fields.qrValue;
    if (!value) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(value, {
      margin: 0,
      width: 96,
      errorCorrectionLevel: "M",
    }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [liveTag?.fields.qrValue]);

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

  function assertMfgForward(value: string) {
    if (productCreatedMin && value < productCreatedMin) {
      setError(t.owner.mfgForwardOnly);
      return false;
    }
    return true;
  }

  async function persistDatesToBatch() {
    if (!batchId || !mfgDate || !expDate) {
      setError(t.owner.expRequiredAtPrint);
      return false;
    }
    if (!assertMfgForward(mfgDate)) return false;
    setSavingDates(true);
    setError(null);
    try {
      const res = await api.owner.updateBatch(batchId, {
        manufacturedAt: mfgDate,
        expiresAt: expDate,
      });
      setBatches((prev) =>
        prev.map((b) => (b.id === res.batch.id ? res.batch : b)),
      );
      setOkMsg(t.owner.datesSaved);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      return false;
    } finally {
      setSavingDates(false);
    }
  }

  async function onSaveDatesOnly() {
    setOkMsg(null);
    await persistDatesToBatch();
  }

  const mmToPx = (mm: number) => Math.round((mm / 25.4) * 96);
  const canPrint = Boolean(liveTag && mfgDate && expDate && productId && batchId);

  return (
    <div className="owner-page tags-page">
      <header className="owner-header">
        <div>
          <p className="eyebrow">{t.owner.navTags}</p>
          <h1>{t.owner.tagsTitle}</h1>
          <p className="muted">{t.owner.tagsHint}</p>
        </div>
      </header>

      {error ? <p className="error-banner">{error}</p> : null}
      {okMsg ? <p className="ok-banner">{okMsg}</p> : null}

      <div className="tags-layout">
        <section className="panel-card tags-controls">
          <h2>{t.owner.printPreview}</h2>
          <p className="muted tiny">{t.owner.tagDateHint}</p>
          {productCreatedMin ? (
            <p className="muted tiny">
              {t.owner.productCreatedLabel}: {productCreatedMin}
            </p>
          ) : null}
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
                {productBatches.length === 0 ? (
                  <option value="">{t.owner.noBatch}</option>
                ) : (
                  productBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.batchCode}
                      {b.expiresAt
                        ? ` · exp ${new Date(b.expiresAt).toLocaleDateString()}`
                        : ""}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label>
              {t.owner.fieldMfgDate}
              <input
                type="date"
                required
                min={productCreatedMin || undefined}
                value={mfgDate}
                onChange={(e) => {
                  const next = e.target.value;
                  if (productCreatedMin && next < productCreatedMin) {
                    setError(t.owner.mfgForwardOnly);
                    setMfgDate(productCreatedMin);
                    return;
                  }
                  setError(null);
                  setOkMsg(null);
                  setMfgDate(next);
                  if (expDate && next && expDate < next) setExpDate(next);
                }}
              />
              <span className="muted tiny">{t.owner.mfgForwardHint}</span>
            </label>
            <label>
              {t.owner.fieldExpDate}
              <input
                type="date"
                required
                min={mfgDate || productCreatedMin || undefined}
                value={expDate}
                onChange={(e) => {
                  setError(null);
                  setOkMsg(null);
                  setExpDate(e.target.value);
                }}
              />
              <span className="muted tiny">{t.owner.expAtPrintHint}</span>
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
              <label className="check full save-dates-check">
                <input
                  type="checkbox"
                  checked={saveDates}
                  onChange={(e) => setSaveDates(e.target.checked)}
                />
                {t.owner.saveDatesToBatch}
              </label>
            ) : null}
          </div>

          <div className="tag-actions">
            {canWrite ? (
              <button
                type="button"
                className="cta secondary"
                onClick={() => void onSaveDatesOnly()}
                disabled={
                  !batchId || !mfgDate || !expDate || savingDates
                }
              >
                {savingDates ? "…" : t.owner.saveDatesOnly}
              </button>
            ) : null}
            <button
              type="button"
              className="cta"
              onClick={() => {
                void (async () => {
                  if (saveDates && canWrite) {
                    const ok = await persistDatesToBatch();
                    if (!ok) return;
                  }
                  window.print();
                })();
              }}
              disabled={!canPrint || savingDates}
            >
              {t.owner.printTag}
            </button>
          </div>
        </section>

        <section className="panel-card tags-live-preview">
          <h2>{t.owner.previewTag}</h2>
          <p className="muted tiny">{t.owner.tagLiveHint}</p>
          {liveTag ? (
            <div className="tag-print-area">
              <div
                className="product-tag"
                style={{
                  width: mmToPx(liveTag.size.widthMm),
                  minHeight: mmToPx(liveTag.size.heightMm),
                }}
              >
                {liveTag.fields.company ? (
                  <p className="tag-brand">{liveTag.fields.company}</p>
                ) : null}
                <p className="tag-name">{liveTag.fields.productName}</p>
                {liveTag.fields.sku ? (
                  <p className="tag-row">SKU: {liveTag.fields.sku}</p>
                ) : null}
                {liveTag.fields.priceBdt != null ? (
                  <p className="tag-price">৳{liveTag.fields.priceBdt}</p>
                ) : null}
                {liveTag.fields.description ? (
                  <p className="tag-desc">{liveTag.fields.description}</p>
                ) : null}
                {liveTag.fields.batchCode ? (
                  <p className="tag-row">
                    Batch: {liveTag.fields.batchCode}
                  </p>
                ) : null}
                {selectedTemplate?.showMfgDate !== false ? (
                  <p className="tag-row">
                    MFG: {formatTagDate(mfgDate)}
                  </p>
                ) : null}
                {selectedTemplate?.showExpDate !== false ? (
                  <p className="tag-row">
                    EXP: {formatTagDate(expDate)}
                  </p>
                ) : null}
                {qrDataUrl ? (
                  <img className="tag-qr" src={qrDataUrl} alt="QR" />
                ) : null}
              </div>
            </div>
          ) : (
            <p className="muted">{t.owner.cartEmpty}</p>
          )}
        </section>

        {canWrite ? (
          <section className="panel-card tags-template-form">
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

              <fieldset className="tag-fields full">
                <legend>{t.owner.tagFieldsLegend}</legend>
                <p className="muted tiny">{t.owner.tagFieldsHint}</p>
                <div className="tag-field-grid">
                  {(
                    [
                      ["showCompany", t.owner.tagFieldCompany],
                      ["showSku", t.owner.tagFieldSku],
                      ["showPrice", t.owner.tagFieldPrice],
                      ["showDescription", t.owner.tagFieldDescription],
                      ["showMfgDate", t.owner.tagFieldMfg],
                      ["showExpDate", t.owner.tagFieldExp],
                      ["showBatch", t.owner.tagFieldBatch],
                      ["showQr", t.owner.tagFieldQr],
                    ] as const
                  ).map(([key, label]) => (
                    <label
                      key={key}
                      className={
                        form[key]
                          ? "tag-field-chip active"
                          : "tag-field-chip"
                      }
                    >
                      <input
                        type="checkbox"
                        checked={form[key]}
                        onChange={(e) =>
                          setForm({ ...form, [key]: e.target.checked })
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="check full tag-default-check">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) =>
                    setForm({ ...form, isDefault: e.target.checked })
                  }
                />
                <span>{t.owner.fieldDefault}</span>
              </label>
              <button type="submit" className="cta" disabled={pending}>
                {t.owner.saveTemplate}
              </button>
            </form>
          </section>
        ) : null}
      </div>

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
