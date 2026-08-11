import { useEffect, useMemo, useState, useTransition } from "react";
import { Link } from "react-router-dom";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import {
  confirmDetails,
  useConfirmAction,
} from "../../components/ConfirmActionDialog";
import { ProductCatalogModal } from "../../components/ProductCatalogModal";
import {
  api,
  type Product,
  type ProductProductionStat,
  type ProductionBatch,
} from "../../lib/api";
import { categoryLabel, packTypeLabel } from "../../lib/productCatalog";
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

export function OwnerProductsPage({ locale }: Props) {
  const t = getMessages(locale);
  const { confirm } = useConfirmAction();
  const user = getStoredUser();
  const canWrite = user?.role.code === "OWNER";
  const canMarkDefect =
    user?.role.code === "OWNER" || user?.role.code === "MANAGER";
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<ProductProductionStat[]>([]);
  const [units, setUnits] = useState<
    Array<{ code: string; nameEn: string; nameBn: string }>
  >([]);
  const [modalProduct, setModalProduct] = useState<Product | null | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [scanQuery, setScanQuery] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  const statsByProduct = useMemo(
    () => new Map(stats.map((s) => [s.productId, s])),
    [stats],
  );

  const catLabels = {
    catDrinking: t.owner.catDrinking,
    catDistilled: t.owner.catDistilled,
    catBattery: t.owner.catBattery,
    catHandwash: t.owner.catHandwash,
    catDishwash: t.owner.catDishwash,
    catCleaner: t.owner.catCleaner,
    catOther: t.owner.catOther,
  };
  const packLabels = {
    packBottle: t.owner.packBottle,
    packSachet: t.owner.packSachet,
    packJar: t.owner.packJar,
    packBox: t.owner.packBox,
    packOther: t.owner.packOther,
  };

  async function load() {
    const [prod, unitRes, statRes] = await Promise.all([
      api.owner.products(),
      api.auth.units(),
      api.owner.productStats(),
    ]);
    setProducts(prod.products);
    setUnits(unitRes.units);
    setStats(statRes.stats);
  }

  useEffect(() => {
    startTransition(() => {
      void load().catch((err) =>
        setError(err instanceof Error ? err.message : "Failed"),
      );
    });
  }, []);

  function openCreate() {
    setModalProduct(null);
  }

  function openEdit(p: Product) {
    setModalProduct(p);
  }

  function closeModal() {
    setModalProduct(undefined);
  }

  async function onSaved(wasEdit: boolean) {
    setOkMsg(wasEdit ? t.owner.productUpdated : t.owner.productCreated);
    await load();
  }

  async function deactivate(id: string) {
    const product = products.find((p) => p.id === id);
    const stat = statsByProduct.get(id);
    const decision = await confirm({
      title: t.common.confirmDeleteTitle,
      message: t.common.confirmDeleteMessage,
      tone: "danger",
      confirmLabel: t.common.confirmDelete,
      cancelLabel: t.common.cancel,
      details: confirmDetails(
        [
          { label: t.common.fieldId, value: id },
          { label: t.owner.fieldSku, value: product?.sku },
          { label: t.owner.fieldProductName, value: product?.name },
          {
            label: t.owner.fieldPrice,
            value:
              product != null
                ? `৳${product.priceBdt.toLocaleString()}`
                : undefined,
          },
          { label: t.owner.statInStock, value: stat?.qtyInStock },
        ],
        { skipEmpty: true },
      ),
    });
    if (!decision.ok) return;

    setError(null);
    try {
      await api.owner.deactivateProduct(id);
      if (modalProduct?.id === id) closeModal();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function onProductImage(id: string, file: File | null, sku: string) {
    if (!file) return;
    const product = products.find((p) => p.id === id);
    const decision = await confirm({
      title: t.common.confirmUpdateTitle,
      message: t.common.confirmUpdateMessage,
      tone: "update",
      confirmLabel: t.common.confirmUpdate,
      cancelLabel: t.common.cancel,
      details: confirmDetails(
        [
          { label: t.common.fieldId, value: id },
          { label: t.owner.fieldSku, value: sku },
          { label: t.owner.fieldProductName, value: product?.name },
          { label: t.owner.fieldProductImage, value: file.name },
        ],
        { skipEmpty: true },
      ),
    });
    if (!decision.ok) return;

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

  function formatUnitStatus(status: string | null) {
    if (!status) return "—";
    if (status === "IN_STOCK") return t.public.unitStatusInStock;
    if (status === "SOLD") return t.public.unitStatusSold;
    if (status === "VOID") return t.public.unitStatusVoid;
    if (status === "DEFECT") return t.owner.unitStatusDefect;
    return status;
  }

  async function markDefect(serialCode: string, productSku: string) {
    const decision = await confirm({
      title: t.owner.markUnitDefectTitle,
      message: t.owner.markUnitDefectMessage,
      tone: "danger",
      confirmLabel: t.owner.markUnitDefect,
      cancelLabel: t.common.cancel,
      reasonLabel: t.owner.markUnitDefectReason,
      reasonPlaceholder: t.owner.markUnitDefectReasonPlaceholder,
      reasonMinLength: 5,
      details: confirmDetails(
        [
          { label: t.owner.fieldSku, value: productSku },
          { label: t.public.unitSerial, value: serialCode },
        ],
        { skipEmpty: true },
      ),
    });
    if (!decision.ok || !decision.reason) return;

    setError(null);
    setOkMsg(null);
    try {
      await api.owner.markUnitDefect({
        serialCode,
        reason: decision.reason.trim(),
      });
      setOkMsg(t.owner.markUnitDefectOk.replace("{code}", serialCode));
      setScanResult((prev) =>
        prev
          ? {
              ...prev,
              unitStatus: "DEFECT",
            }
          : null,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
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

  const modalOpen = modalProduct !== undefined;

  return (
    <div className="owner-page">
      <header className="owner-header">
        <div>
          <p className="eyebrow">{t.owner.navProducts}</p>
          <h1>{t.owner.productsTitle}</h1>
          <p className="muted">{t.owner.productsHint}</p>
        </div>
        {canWrite ? (
          <button
            type="button"
            className="btn primary"
            onClick={openCreate}
            disabled={pending}
          >
            {t.owner.addProduct}
          </button>
        ) : null}
      </header>

      {okMsg ? <p className="ok">{okMsg}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {uploading ? <p className="muted">{t.owner.uploading}</p> : null}

      <p className="muted tiny">{t.owner.productionStatsHint}</p>

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
          <div className="full scan-result-inline">
            <p>
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
              {scanResult.unitSerial ? (
                <>
                  {" · "}
                  {scanResult.unitSerial}
                  {" · "}
                  {t.owner.scanUnitStatus}:{" "}
                  {formatUnitStatus(scanResult.unitStatus)}
                </>
              ) : null}
              {" · "}
              <Link
                to={`/owner/batches?productId=${scanResult.product.id}${
                  scanResult.batch ? `&batchId=${scanResult.batch.id}` : ""
                }`}
              >
                {t.owner.navBatches}
              </Link>
            </p>
            {canMarkDefect &&
            scanResult.unitSerial &&
            scanResult.unitStatus === "IN_STOCK" ? (
              <button
                type="button"
                className="btn danger compact"
                onClick={() =>
                  void markDefect(
                    scanResult.unitSerial!,
                    scanResult.product.sku,
                  )
                }
              >
                {t.owner.markUnitDefect}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {!canWrite ? (
        <p className="muted">{t.owner.productsOwnerOnly}</p>
      ) : null}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t.owner.uploadProductImage}</th>
              <th>{t.owner.fieldProductName}</th>
              <th>{t.owner.fieldSku}</th>
              <th>{t.owner.fieldCategory}</th>
              <th>{t.owner.fieldPackType}</th>
              <th>{t.owner.fieldSize}</th>
              <th>{t.owner.fieldPrice}</th>
              <th>{t.owner.statBuilt}</th>
              <th>{t.owner.statSold}</th>
              <th>{t.owner.statInStock}</th>
              <th>{t.owner.fieldStatus}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const stat = statsByProduct.get(p.id);
              return (
                <tr key={p.id} className={p.isActive ? "" : "dim"}>
                  <td data-label={t.owner.uploadProductImage}>
                    {p.imageUrl ? (
                      <img
                        className="product-thumb"
                        src={p.imageUrl}
                        alt=""
                      />
                    ) : canWrite ? (
                      <label className="upload-inline">
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) =>
                            void onProductImage(
                              p.id,
                              e.target.files?.[0] ?? null,
                              p.sku,
                            )
                          }
                        />
                        {t.owner.uploadProductImage}
                      </label>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td data-label={t.owner.fieldProductName}>
                    {locale === "bn" && p.nameBn ? p.nameBn : p.name}
                  </td>
                  <td className="cell-id" data-label={t.owner.fieldSku}>
                    {p.sku}
                  </td>
                  <td data-label={t.owner.fieldCategory}>
                    {categoryLabel(p.category, catLabels)}
                  </td>
                  <td data-label={t.owner.fieldPackType}>
                    {packTypeLabel(p.packType ?? "BOTTLE", packLabels)}
                    {p.packType === "BOX" && p.unitsPerPack ? (
                      <div className="muted tiny">
                        {t.owner.packBoxLabel.replace(
                          "{count}",
                          String(p.unitsPerPack),
                        )}
                        {p.innerProduct
                          ? ` · ${p.innerProduct.sku}`
                          : null}
                      </div>
                    ) : null}
                  </td>
                  <td data-label={t.owner.fieldSize}>{formatSizeUnit(p)}</td>
                  <td data-label={t.owner.fieldPrice}>৳{p.priceBdt}</td>
                  <td data-label={t.owner.statBuilt}>{stat?.qtyBuilt ?? 0}</td>
                  <td data-label={t.owner.statSold}>{stat?.qtySold ?? 0}</td>
                  <td
                    data-label={t.owner.statInStock}
                    className={
                      p.stockQty <= p.minStock && p.minStock > 0 ? "warn" : ""
                    }
                  >
                    {stat?.qtyInStock ?? p.stockQty}
                  </td>
                  <td data-label={t.owner.fieldStatus}>
                    {p.isActive ? t.owner.statusActive : t.owner.statusInactive}
                  </td>
                  <td className="cell-actions" data-label={t.owner.batchActions}>
                    {canWrite && p.isActive ? (
                      <>
                        <button
                          type="button"
                          className="linkish"
                          onClick={() => openEdit(p)}
                        >
                          {t.common.edit}
                        </button>
                        <button
                          type="button"
                          className="linkish dangerish"
                          onClick={() => void deactivate(p.id)}
                        >
                          {t.owner.deactivate}
                        </button>
                      </>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!products.length ? (
          <p className="muted">{t.owner.productsEmpty}</p>
        ) : null}
      </div>

      <ProductCatalogModal
        open={modalOpen}
        locale={locale}
        product={modalProduct ?? null}
        products={products}
        units={units}
        onClose={closeModal}
        onSaved={onSaved}
        onUnitsUpdated={setUnits}
      />
    </div>
  );
}
