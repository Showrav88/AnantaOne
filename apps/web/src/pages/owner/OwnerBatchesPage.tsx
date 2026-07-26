import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import {
  api,
  type Product,
  type ProductionBatch,
} from "../../lib/api";
import {
  confirmDetails,
  useConfirmAction,
} from "../../components/ConfirmActionDialog";
import { getStoredUser } from "../../lib/session";

type Props = { locale: LocaleCode };

const empty = {
  productId: "",
  batchCode: "",
  manufacturedAt: new Date().toISOString().slice(0, 10),
  expiresAt: "",
  qtyProduced: "",
  note: "",
  generateUnitTags: true,
};

export function OwnerBatchesPage({ locale }: Props) {
  const t = getMessages(locale);
  const { confirm } = useConfirmAction();
  const user = getStoredUser();
  const [searchParams] = useSearchParams();
  const canWrite =
    user?.role.code === "OWNER" || user?.role.code === "MANAGER";
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [editId, setEditId] = useState<string | null>(null);
  const [editMfg, setEditMfg] = useState("");
  const [editExp, setEditExp] = useState("");
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [highlightBatchId, setHighlightBatchId] = useState<string | null>(
    searchParams.get("batchId"),
  );
  const [scanQuery, setScanQuery] = useState("");

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

  useEffect(() => {
    const productId = searchParams.get("productId");
    const batchId = searchParams.get("batchId");
    if (productId) {
      setForm((f) => ({ ...f, productId }));
    }
    if (batchId) setHighlightBatchId(batchId);
  }, [searchParams]);

  async function applyScan(raw: string) {
    setError(null);
    setOkMsg(null);
    try {
      const res = await api.owner.lookupUnitScan(raw);
      if (!res.batch) {
        setError(t.owner.scanNoBatch.replace("{sku}", res.product.sku));
        setForm((f) => ({ ...f, productId: res.product.id }));
        setHighlightBatchId(null);
        return;
      }
      setForm((f) => ({ ...f, productId: res.product.id }));
      setHighlightBatchId(res.batch.id);
      setOkMsg(
        t.owner.scanBatchFound
          .replace("{batch}", res.batch.batchCode)
          .replace("{sku}", res.product.sku),
      );
      setScanQuery("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    }
  }

  function startEdit(b: ProductionBatch) {
    setEditId(b.id);
    setEditMfg(new Date(b.manufacturedAt).toISOString().slice(0, 10));
    setEditExp(
      b.expiresAt ? new Date(b.expiresAt).toISOString().slice(0, 10) : "",
    );
  }

  function productLabel(productId: string) {
    const product = products.find((p) => p.id === productId);
    if (!product) return productId;
    const name = locale === "bn" && product.nameBn ? product.nameBn : product.name;
    return `${name} (${product.sku})`;
  }

  function batchProductLabel(b: ProductionBatch) {
    const name =
      locale === "bn" && b.product?.nameBn
        ? b.product.nameBn
        : (b.product?.name ?? b.productId);
    return b.product?.sku ? `${name} (${b.product.sku})` : name;
  }

  async function saveEdit(b: ProductionBatch) {
    setError(null);
    setOkMsg(null);
    const decision = await confirm({
      title: t.common.confirmUpdateTitle,
      message: t.common.confirmUpdateMessage,
      tone: "update",
      confirmLabel: t.common.confirmUpdate,
      cancelLabel: t.common.cancel,
      details: confirmDetails(
        [
          { label: t.common.fieldId, value: b.id },
          { label: t.owner.fieldBatchCode, value: b.batchCode },
          { label: t.owner.fieldProduct, value: batchProductLabel(b) },
          { label: t.owner.fieldQtyProduced, value: b.qtyProduced },
          { label: t.owner.fieldMfgDate, value: editMfg },
          { label: t.owner.fieldExpDate, value: editExp },
        ],
        { skipEmpty: true },
      ),
    });
    if (!decision.ok) return;

    try {
      await api.owner.updateBatch(b.id, {
        manufacturedAt: editMfg,
        expiresAt: editExp || null,
      });
      setEditId(null);
      setOkMsg(t.owner.datesSaved);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function onCreate(e: FormEvent) {
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
          { label: t.owner.fieldProduct, value: productLabel(form.productId) },
          {
            label: t.owner.fieldBatchCode,
            value: form.batchCode.trim() || t.common.autoAssigned,
          },
          { label: t.owner.fieldMfgDate, value: form.manufacturedAt },
          { label: t.owner.fieldExpDate, value: form.expiresAt },
          { label: t.owner.fieldQtyProduced, value: form.qtyProduced },
          { label: t.owner.generateUnitTags, value: form.generateUnitTags ? "yes" : "no" },
          { label: t.owner.fieldNote, value: form.note },
        ],
        { skipEmpty: true },
      ),
    });
    if (!decision.ok) return;

    try {
      await api.owner.createBatch({
        productId: form.productId,
        ...(form.batchCode.trim()
          ? { batchCode: form.batchCode.trim() }
          : {}),
        manufacturedAt: form.manufacturedAt,
        expiresAt: form.expiresAt || null,
        qtyProduced: Number(form.qtyProduced),
        note: form.note || null,
        addToStock: true,
        generateUnitTags: form.generateUnitTags,
      });
      setForm({
        ...empty,
        productId: form.productId,
        manufacturedAt: empty.manufacturedAt,
        generateUnitTags: form.generateUnitTags,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function confirmReverse(b: ProductionBatch) {
    setError(null);
    setOkMsg(null);
    const decision = await confirm({
      title: t.owner.reverseBatchTitle,
      message: t.owner.reverseBatchHint.replace("{code}", b.batchCode),
      tone: "danger",
      confirmLabel: t.owner.confirmReverseBatch,
      cancelLabel: t.common.cancel,
      details: confirmDetails(
        [
          { label: t.common.fieldId, value: b.id },
          { label: t.owner.fieldBatchCode, value: b.batchCode },
          { label: t.owner.fieldProduct, value: batchProductLabel(b) },
          { label: t.owner.fieldQtyProduced, value: b.qtyProduced },
          { label: t.owner.fieldQtyLeft, value: `${b.qtyRemaining} / ${b.qtyProduced}` },
        ],
        { skipEmpty: true },
      ),
      reasonLabel: t.owner.batchSoftDeleteReason,
      reasonPlaceholder: t.owner.batchSoftDeleteReasonHint,
      reasonMinLength: 5,
    });
    if (!decision.ok) return;

    try {
      await api.owner.reverseBatch(b.id, decision.reason ?? "");
      setOkMsg(t.owner.batchReversed);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  function serialRangeLabel(b: ProductionBatch) {
    if (b.serialStart == null || b.serialEnd == null) return "—";
    return `${b.serialStart}–${b.serialEnd}`;
  }

  function batchStatus(b: ProductionBatch) {
    if (b.reversedAt || !b.isActive) {
      return {
        key: "soft" as const,
        label: t.owner.batchStatusSoftDeleted,
      };
    }
    if (b.qtyRemaining < b.qtyProduced) {
      return {
        key: "part" as const,
        label: t.owner.batchStatusPartSold,
      };
    }
    return { key: "active" as const, label: t.owner.batchStatusActive };
  }

  return (
    <div className="owner-page">
      <header className="owner-header no-print">
        <div>
          <p className="eyebrow">{t.owner.navBatches}</p>
          <h1>{t.owner.batchesTitle}</h1>
          <p className="muted">{t.owner.batchesHint}</p>
        </div>
      </header>

      <section className="batch-guide no-print panel-card">
        <div>
          <strong>{t.owner.batchesGuideProduction}</strong>
          <p className="muted tiny">{t.owner.batchesGuideProductionHint}</p>
        </div>
        <div>
          <strong>{t.owner.batchesGuideDelete}</strong>
          <p className="muted tiny">{t.owner.batchesGuideDeleteHint}</p>
        </div>
      </section>

      {error ? <p className="error-banner no-print">{error}</p> : null}
      {okMsg ? <p className="ok-banner no-print">{okMsg}</p> : null}

      <div className="owner-form compact scan-bar no-print">
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
      </div>

      {canWrite ? (
        <form className="owner-form compact no-print" onSubmit={onCreate}>
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
              placeholder={t.owner.batchCodeAuto}
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
          <label className="full checkbox-row">
            <input
              type="checkbox"
              checked={form.generateUnitTags}
              onChange={(e) =>
                setForm({ ...form, generateUnitTags: e.target.checked })
              }
            />
            <span>{t.owner.generateUnitTags}</span>
          </label>
          <button type="submit" className="cta" disabled={pending}>
            {t.owner.addBatch}
          </button>
        </form>
      ) : null}

      <h2 className="no-print">{t.owner.batchesListTitle}</h2>
      <div className="owner-table-wrap no-print">
        <table className="owner-table">
          <thead>
            <tr>
              <th>{t.owner.fieldBatchCode}</th>
              <th>{t.owner.batchStatus}</th>
              <th>{t.owner.fieldProduct}</th>
              <th>{t.owner.fieldMfgDate}</th>
              <th>{t.owner.fieldExpDate}</th>
              <th>{t.owner.fieldQtyLeft}</th>
              <th>{t.owner.serialRange}</th>
              {canWrite ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 ? (
              <tr>
                <td colSpan={canWrite ? 8 : 7} className="muted">
                  {t.owner.batchesEmpty}
                </td>
              </tr>
            ) : (
              batches.map((b) => {
                const status = batchStatus(b);
                const softDeleted = status.key === "soft";
                const canSoftDelete =
                  !softDeleted && b.qtyRemaining >= b.qtyProduced;
                return (
                  <tr
                    key={b.id}
                    className={[
                      softDeleted ? "dim" : "",
                      highlightBatchId === b.id ? "row-highlight" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    id={highlightBatchId === b.id ? "scanned-batch" : undefined}
                  >
                    <td data-label={t.owner.fieldBatchCode}>
                      <strong>{b.batchCode}</strong>
                    </td>
                    <td data-label={t.owner.batchStatus}>
                      <span className={`batch-status-pill status-${status.key}`}>
                        {status.label}
                      </span>
                      {b.reverseReason ? (
                        <div className="muted tiny">{b.reverseReason}</div>
                      ) : null}
                    </td>
                    <td data-label={t.owner.fieldProduct}>
                      {locale === "bn" && b.product?.nameBn
                        ? b.product.nameBn
                        : (b.product?.name ?? "—")}
                      <div className="muted tiny">{b.product?.sku}</div>
                    </td>
                    <td data-label={t.owner.fieldMfgDate}>
                      {editId === b.id ? (
                        <input
                          type="date"
                          className="qty-input"
                          value={editMfg}
                          onChange={(e) => setEditMfg(e.target.value)}
                        />
                      ) : (
                        new Date(b.manufacturedAt).toLocaleDateString()
                      )}
                    </td>
                    <td data-label={t.owner.fieldExpDate}>
                      {editId === b.id ? (
                        <input
                          type="date"
                          className="qty-input"
                          value={editExp}
                          onChange={(e) => setEditExp(e.target.value)}
                        />
                      ) : b.expiresAt ? (
                        new Date(b.expiresAt).toLocaleDateString()
                      ) : (
                        "—"
                      )}
                    </td>
                    <td data-label={t.owner.fieldQtyLeft}>
                      {b.qtyRemaining} / {b.qtyProduced}
                    </td>
                    <td data-label={t.owner.serialRange}>
                      {serialRangeLabel(b)}
                    </td>
                    {canWrite ? (
                      <td className="cell-actions" data-label={t.owner.batchActions}>
                        {editId === b.id ? (
                          <div className="batch-actions">
                            <button
                              type="button"
                              className="btn primary compact"
                              onClick={() => void saveEdit(b)}
                            >
                              {t.owner.saved}
                            </button>
                            <button
                              type="button"
                              className="btn ghost compact"
                              onClick={() => setEditId(null)}
                            >
                              {t.common.cancel}
                            </button>
                          </div>
                        ) : (
                          <div className="batch-actions">
                            <div className="batch-actions-safe">
                              {!softDeleted ? (
                                <button
                                  type="button"
                                  className="btn ghost compact"
                                  onClick={() => startEdit(b)}
                                >
                                  {t.owner.editBatchDates}
                                </button>
                              ) : null}
                            {b.serialStart != null ? (
                              <Link
                                className="btn ghost compact"
                                to={`/owner/tags?batchId=${encodeURIComponent(b.id)}&mode=units`}
                              >
                                {t.owner.viewUnitTags}
                              </Link>
                            ) : null}
                            </div>
                            {canSoftDelete ? (
                              <button
                                type="button"
                                className="btn ghost compact dark batch-soft-delete"
                                onClick={() => void confirmReverse(b)}
                              >
                                {t.owner.reverseBatch}
                              </button>
                            ) : !softDeleted ? (
                              <p className="muted tiny batch-soft-delete-hint">
                                {t.owner.batchSoftDeleteBlocked}
                              </p>
                            ) : null}
                          </div>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
