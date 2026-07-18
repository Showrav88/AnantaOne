import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { useSearchParams } from "react-router-dom";
import QRCode from "qrcode";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import {
  api,
  type Product,
  type ProductionBatch,
  type ProductUnitTag,
  type TagTemplate,
} from "../../lib/api";
import { makeShortSerialCode } from "../../lib/shortCodes";
import { getStoredUser } from "../../lib/session";

type Props = { locale: LocaleCode };

type PrintMode = "sample" | "units";

type PrintUnitRow = ProductUnitTag & { qrDataUrl: string };

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
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [printMode, setPrintMode] = useState<PrintMode>("units");
  const [serialFrom, setSerialFrom] = useState("");
  const [serialTo, setSerialTo] = useState("");
  const [printUnits, setPrintUnits] = useState<PrintUnitRow[]>([]);
  const [printingUnits, setPrintingUnits] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingDates, setSavingDates] = useState(false);
  const [pending, startTransition] = useTransition();
  const lastProductId = useRef("");
  const lastBatchId = useRef("");
  const bootstrappedQuery = useRef(false);

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

  // Deep-link from Batches: ?batchId=&mode=units
  useEffect(() => {
    if (bootstrappedQuery.current || !batches.length) return;
    const qBatch = searchParams.get("batchId");
    const qMode = searchParams.get("mode");
    if (!qBatch) {
      bootstrappedQuery.current = true;
      return;
    }
    const found = batches.find((b) => b.id === qBatch);
    if (found) {
      setProductId(found.productId);
      setBatchId(found.id);
      if (qMode === "units" || qMode === "sample") setPrintMode(qMode);
      bootstrappedQuery.current = true;
    }
  }, [batches, searchParams]);

  // Live sync MFG/EXP + serial range from selected batch (real-time reflection).
  useEffect(() => {
    if (!selectedBatch) {
      if (selectedProduct?.createdAt) {
        setMfgDate(toDateInput(selectedProduct.createdAt));
      } else {
        setMfgDate("");
      }
      setExpDate("");
      setSerialFrom("");
      setSerialTo("");
      lastBatchId.current = "";
      return;
    }
    const batchChanged = lastBatchId.current !== selectedBatch.id;
    lastBatchId.current = selectedBatch.id;
    setMfgDate(toDateInput(selectedBatch.manufacturedAt));
    setExpDate(
      selectedBatch.expiresAt ? toDateInput(selectedBatch.expiresAt) : "",
    );
    if (batchChanged) {
      if (selectedBatch.serialStart != null && selectedBatch.serialEnd != null) {
        setSerialFrom(String(selectedBatch.serialStart));
        setSerialTo(String(selectedBatch.serialEnd));
      } else {
        setSerialFrom("");
        setSerialTo("");
      }
      setPrintUnits([]);
    }
  }, [selectedBatch, selectedProduct?.createdAt]);

  useEffect(() => {
    const tpl = templates.find((x) => x.id === templateId);
    if (tpl) {
      setPrintWidth(String(tpl.widthMm));
      setPrintHeight(String(tpl.heightMm));
    }
  }, [templateId, templates]);

  const serialCount = useMemo(() => {
    const from = Number(serialFrom);
    const to = Number(serialTo);
    if (!(from > 0) || !(to >= from)) return 0;
    return to - from + 1;
  }, [serialFrom, serialTo]);

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
    const sampleSerial = Number(serialFrom) || selectedBatch?.serialStart || 1;
    const unitSerialCode = selectedProduct
      ? makeShortSerialCode(selectedProduct.sku, sampleSerial)
      : null;
    const qrValue =
      tpl.showQr && company?.slug && selectedBatch
        ? printMode === "units" && unitSerialCode
          ? `${window.location.origin}${window.location.pathname}#/unit/${company.slug}/${encodeURIComponent(unitSerialCode)}`
          : `${window.location.origin}${window.location.pathname}#/tag/${company.slug}/${encodeURIComponent(selectedProduct.sku)}/${encodeURIComponent(selectedBatch.batchCode)}`
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
        serialNo: printMode === "units" ? sampleSerial : null,
        serialCode: printMode === "units" ? unitSerialCode : null,
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
    printMode,
    serialFrom,
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
  const canPrintSample = Boolean(
    liveTag && mfgDate && expDate && productId && batchId,
  );
  const canPrintUnits = Boolean(
    canPrintSample &&
      selectedBatch?.serialStart != null &&
      serialCount > 0 &&
      serialCount <= 2000,
  );

  async function printUnitRange() {
    if (!batchId || !canPrintUnits) return;
    const from = Number(serialFrom);
    const to = Number(serialTo);
    if (!(from > 0) || !(to >= from)) {
      setError(t.owner.unitPrintRangeInvalid);
      return;
    }
    setError(null);
    setOkMsg(null);
    setPrintingUnits(true);
    setPrintUnits([]);
    try {
      if (saveDates && canWrite) {
        const ok = await persistDatesToBatch();
        if (!ok) return;
      }
      const chunk = 100;
      const collected: PrintUnitRow[] = [];
      let offset = 0;
      let total = Infinity;
      while (offset < total && collected.length < to - from + 1) {
        const res = await api.owner.batchUnits(batchId, {
          serialFrom: from,
          serialTo: to,
          limit: chunk,
          offset,
        });
        total = res.meta.total;
        if (!res.units.length) break;
        for (const u of res.units) {
          const qrDataUrl = await QRCode.toDataURL(u.qrUrl, {
            margin: 0,
            width: 128,
            errorCorrectionLevel: "M",
          });
          collected.push({ ...u, qrDataUrl });
        }
        offset += res.units.length;
        if (res.units.length < chunk) break;
      }
      if (!collected.length) {
        setError(t.owner.unitTagsEmpty);
        return;
      }
      setPrintUnits(collected);
      setOkMsg(
        t.owner.unitPrintReady.replace("{count}", String(collected.length)),
      );
      // Let React paint the print sheet, then open the dialog.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => window.print());
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setPrintingUnits(false);
    }
  }

  return (
    <div className="owner-page tags-page">
      <header className="owner-header no-print">
        <div>
          <p className="eyebrow">{t.owner.navTags}</p>
          <h1>{t.owner.tagsTitle}</h1>
          <p className="muted">{t.owner.tagsHint}</p>
          <p className="muted tiny">{t.owner.unitPrintHint}</p>
        </div>
      </header>

      {error ? <p className="error-banner">{error}</p> : null}
      {okMsg ? <p className="ok-banner">{okMsg}</p> : null}

      <div className="tags-layout no-print">
        <section className="panel-card tags-controls">
          <h2>{t.owner.printPreview}</h2>
          <p className="muted tiny">{t.owner.tagDateHint}</p>
          {productCreatedMin ? (
            <p className="muted tiny">
              {t.owner.productCreatedLabel}: {productCreatedMin}
            </p>
          ) : null}
          <div className="owner-form compact">
            <label className="full">
              {t.owner.tagPrintMode}
              <select
                value={printMode}
                onChange={(e) => {
                  setPrintMode(e.target.value as PrintMode);
                  setPrintUnits([]);
                  const next = new URLSearchParams(searchParams);
                  next.set("mode", e.target.value);
                  if (batchId) next.set("batchId", batchId);
                  setSearchParams(next, { replace: true });
                }}
              >
                <option value="units">{t.owner.tagPrintModeUnits}</option>
                <option value="sample">{t.owner.tagPrintModeSample}</option>
              </select>
            </label>
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
                onChange={(e) => {
                  const id = e.target.value;
                  setBatchId(id);
                  const next = new URLSearchParams(searchParams);
                  if (id) next.set("batchId", id);
                  else next.delete("batchId");
                  next.set("mode", printMode);
                  setSearchParams(next, { replace: true });
                }}
              >
                {productBatches.length === 0 ? (
                  <option value="">{t.owner.noBatch}</option>
                ) : (
                  productBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.batchCode}
                      {b.serialStart != null && b.serialEnd != null
                        ? ` · #${b.serialStart}–${b.serialEnd}`
                        : ""}
                      {b.expiresAt
                        ? ` · exp ${new Date(b.expiresAt).toLocaleDateString()}`
                        : ""}
                    </option>
                  ))
                )}
              </select>
            </label>
            {selectedBatch ? (
              <p className="muted tiny full">
                {t.owner.batchSerialRange}:{" "}
                {selectedBatch.serialStart != null &&
                selectedBatch.serialEnd != null
                  ? `#${selectedBatch.serialStart}–${selectedBatch.serialEnd}`
                  : t.owner.unitTagsEmpty}{" "}
                · MFG {formatTagDate(toDateInput(selectedBatch.manufacturedAt))}
                {selectedBatch.expiresAt
                  ? ` · EXP ${formatTagDate(toDateInput(selectedBatch.expiresAt))}`
                  : ""}
              </p>
            ) : null}
            {printMode === "units" ? (
              <>
                <label className="full">
                  {t.owner.unitReprintOne}
                  <input
                    type="number"
                    min={1}
                    placeholder={t.owner.unitReprintOneHint}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      const n = Number((e.target as HTMLInputElement).value);
                      if (!(n > 0)) return;
                      setSerialFrom(String(n));
                      setSerialTo(String(n));
                    }}
                    onBlur={(e) => {
                      const n = Number(e.target.value);
                      if (!(n > 0)) return;
                      setSerialFrom(String(n));
                      setSerialTo(String(n));
                    }}
                  />
                  <span className="muted tiny">{t.owner.unitReprintOneHelp}</span>
                </label>
                <label>
                  {t.owner.unitPrintFrom}
                  <input
                    type="number"
                    min={1}
                    value={serialFrom}
                    onChange={(e) => setSerialFrom(e.target.value)}
                  />
                </label>
                <label>
                  {t.owner.unitPrintTo}
                  <input
                    type="number"
                    min={1}
                    value={serialTo}
                    onChange={(e) => setSerialTo(e.target.value)}
                  />
                </label>
                <p className="muted tiny full">
                  {t.owner.unitPrintCount}: {serialCount || 0}
                  {serialCount === 1
                    ? ` · ${t.owner.unitReprintOneReady}`
                    : ""}
                  {serialCount > 300
                    ? ` · ${t.owner.unitPrintLargeHint}`
                    : ""}
                </p>
                <div className="media-actions full">
                  <button
                    type="button"
                    className="btn ghost compact"
                    disabled={!(Number(serialFrom) > 0)}
                    onClick={() => {
                      const n = Number(serialFrom);
                      if (!(n > 0)) return;
                      setSerialTo(String(n));
                    }}
                  >
                    {t.owner.unitReprintOneBtn}
                  </button>
                  {(
                    [
                      [50, t.owner.unitPrintPreset50],
                      [100, t.owner.unitPrintPreset100],
                      [300, t.owner.unitPrintPreset300],
                    ] as const
                  ).map(([n, label]) => (
                    <button
                      key={n}
                      type="button"
                      className="btn ghost compact"
                      disabled={!selectedBatch?.serialStart}
                      onClick={() => {
                        const start =
                          selectedBatch?.serialStart ??
                          (Number(serialFrom) || 1);
                        setSerialFrom(String(start));
                        setSerialTo(
                          String(
                            Math.min(
                              start + n - 1,
                              selectedBatch?.serialEnd ?? start + n - 1,
                            ),
                          ),
                        );
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
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
            {printMode === "units" ? (
              <button
                type="button"
                className="cta"
                onClick={() => void printUnitRange()}
                disabled={!canPrintUnits || savingDates || printingUnits}
              >
                {printingUnits
                  ? "…"
                  : t.owner.printUnitRange.replace(
                      "{count}",
                      String(serialCount || 0),
                    )}
              </button>
            ) : (
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
                disabled={!canPrintSample || savingDates}
              >
                {t.owner.printTag}
              </button>
            )}
          </div>
        </section>

        <section className="panel-card tags-live-preview">
          <h2>{t.owner.previewTag}</h2>
          <p className="muted tiny">{t.owner.tagLiveHint}</p>
          {liveTag ? (
            <div
              className={
                printMode === "units"
                  ? "tag-print-area sample-only"
                  : "tag-print-area"
              }
            >
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
                {liveTag.fields.serialNo != null ? (
                  <p className="tag-row tag-serial">
                    #{liveTag.fields.serialNo}
                    {liveTag.fields.serialCode
                      ? ` · ${liveTag.fields.serialCode}`
                      : ""}
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
          <section className="panel-card tags-template-form no-print">
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

              <div className="tag-field-list full">
                <p className="tag-field-list-title">{t.owner.tagFieldsLegend}</p>
                <p className="muted tiny">{t.owner.tagFieldsHint}</p>
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
                    ["isDefault", t.owner.fieldDefault],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="tag-field-row">
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
              <button type="submit" className="cta" disabled={pending}>
                {t.owner.saveTemplate}
              </button>
            </form>
          </section>
        ) : null}
      </div>

      <h2 className="section-title no-print">{t.owner.savedTemplates}</h2>
      <ul className="plain-list no-print">
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

      {printUnits.length > 0 ? (
        <section className="unit-range-print-sheet" aria-hidden>
          <div className="unit-range-print-grid">
            {printUnits.map((u) => {
              const productName =
                locale === "bn" && u.product?.nameBn
                  ? u.product.nameBn
                  : (u.product?.name ?? liveTag?.fields.productName ?? "—");
              const widthMm = Number(printWidth) || 50;
              const heightMm = Number(printHeight) || 30;
              return (
                <article
                  key={u.id}
                  className="product-tag unit-print-tag"
                  style={{
                    width: `${widthMm}mm`,
                    minHeight: `${heightMm}mm`,
                  }}
                >
                  {selectedTemplate?.showCompany !== false && company?.name ? (
                    <p className="tag-brand">{company.name}</p>
                  ) : null}
                  <p className="tag-name">{productName}</p>
                  {selectedTemplate?.showSku !== false && u.product?.sku ? (
                    <p className="tag-row">SKU: {u.product.sku}</p>
                  ) : null}
                  {selectedTemplate?.showPrice !== false &&
                  u.product?.priceBdt != null ? (
                    <p className="tag-price">৳{u.product.priceBdt}</p>
                  ) : null}
                  {selectedTemplate?.showBatch !== false ? (
                    <p className="tag-row">
                      Batch: {u.batch?.batchCode ?? selectedBatch?.batchCode}
                    </p>
                  ) : null}
                  <p className="tag-row tag-serial">
                    #{u.serialNo} · {u.serialCode}
                  </p>
                  {selectedTemplate?.showMfgDate !== false ? (
                    <p className="tag-row">MFG: {formatTagDate(mfgDate)}</p>
                  ) : null}
                  {selectedTemplate?.showExpDate !== false ? (
                    <p className="tag-row">EXP: {formatTagDate(expDate)}</p>
                  ) : null}
                  <img className="tag-qr" src={u.qrDataUrl} alt={u.serialCode} />
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
