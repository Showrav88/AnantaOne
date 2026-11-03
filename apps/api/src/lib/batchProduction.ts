import type { Prisma } from "../generated/prisma/client.js";
import { makeShortBatchCode } from "./shortCodes.js";
import { createBatchUnits } from "./productUnits.js";
import { reconcileProductStockQty } from "./productStock.js";
import { pickBatchFefo } from "./sell.js";

type TxClient = Prisma.TransactionClient;

export function parseBatchDate(value: string) {
  return new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
}

export type CreateProductionBatchInput = {
  tenantId: string;
  productId: string;
  qtyProduced: number;
  batchCode?: string | null;
  manufacturedAt: string | Date;
  expiresAt?: string | Date | null;
  note?: string | null;
  generateUnitTags?: boolean;
  addToStock?: boolean;
  createdBy?: string | null;
  tx: TxClient;
};

/** Create a production batch (+ optional unit tags) inside an existing transaction. */
export async function createProductionBatch(opts: CreateProductionBatchInput) {
  const product = await opts.tx.product.findFirst({
    where: { id: opts.productId, tenantId: opts.tenantId, isActive: true },
  });
  if (!product) throw new Error("Product not found");

  const qty = Number(opts.qtyProduced);
  if (!(qty > 0)) throw new Error("Batch qty must be positive");

  const mfg =
    opts.manufacturedAt instanceof Date
      ? opts.manufacturedAt
      : parseBatchDate(opts.manufacturedAt);

  let autoCode = opts.batchCode?.trim();
  if (!autoCode) {
    const prior = await opts.tx.productionBatch.count({
      where: { tenantId: opts.tenantId },
    });
    let seq = prior + 1;
    autoCode = makeShortBatchCode(seq);
    for (let i = 0; i < 5000; i += 1) {
      const exists = await opts.tx.productionBatch.findFirst({
        where: { tenantId: opts.tenantId, batchCode: autoCode },
        select: { id: true },
      });
      if (!exists) break;
      seq += 1;
      autoCode = makeShortBatchCode(seq);
    }
  }

  const created = await opts.tx.productionBatch.create({
    data: {
      tenantId: opts.tenantId,
      productId: product.id,
      batchCode: autoCode.toUpperCase(),
      manufacturedAt: mfg,
      expiresAt: opts.expiresAt
        ? opts.expiresAt instanceof Date
          ? opts.expiresAt
          : parseBatchDate(opts.expiresAt)
        : null,
      qtyProduced: qty,
      qtyRemaining: qty,
      note: opts.note ?? null,
      createdBy: opts.createdBy ?? null,
    },
  });

  if (opts.generateUnitTags !== false) {
    const range = await createBatchUnits({
      tenantId: opts.tenantId,
      productId: product.id,
      productSku: product.sku,
      batchId: created.id,
      batchCode: created.batchCode,
      qty,
      tx: opts.tx,
    });
    if (range.serialStart != null && range.serialEnd != null) {
      await opts.tx.productionBatch.update({
        where: { id: created.id },
        data: {
          serialStart: range.serialStart,
          serialEnd: range.serialEnd,
        },
      });
    }
  }

  if (opts.addToStock !== false) {
    await reconcileProductStockQty(
      opts.tenantId,
      product.id,
      opts.tx,
      opts.createdBy,
    );
  }

  return opts.tx.productionBatch.findUniqueOrThrow({
    where: { id: created.id },
    include: { product: true },
  });
}

export type ProduceBatchOpts = {
  batchCode?: string | null;
  manufacturedAt?: string;
  expiresAt?: string | null;
  generateUnitTags?: boolean;
  note?: string | null;
};

/** Resolve batch for a sale line: existing id, new production, or FEFO. */
export async function resolveBatchForLine(opts: {
  tenantId: string;
  productId: string;
  qty: number;
  batchId?: string | null;
  produceBatch?: ProduceBatchOpts | null;
  createdBy?: string | null;
  tx: TxClient;
}) {
  const qty = Number(opts.qty);
  if (opts.batchId) {
    const batch = await opts.tx.productionBatch.findFirst({
      where: {
        id: opts.batchId,
        tenantId: opts.tenantId,
        productId: opts.productId,
        isActive: true,
        reversedAt: null,
      },
    });
    if (!batch) throw new Error("Batch not found for this product");
    if (Number(batch.qtyRemaining) < qty) {
      throw new Error(
        `Batch ${batch.batchCode} has only ${batch.qtyRemaining} left (need ${qty})`,
      );
    }
    return batch;
  }

  if (opts.produceBatch) {
    const mfg =
      opts.produceBatch.manufacturedAt ??
      new Date().toISOString().slice(0, 10);
    return createProductionBatch({
      tenantId: opts.tenantId,
      productId: opts.productId,
      qtyProduced: qty,
      batchCode: opts.produceBatch.batchCode,
      manufacturedAt: mfg,
      expiresAt: opts.produceBatch.expiresAt ?? null,
      note: opts.produceBatch.note ?? "Online order production",
      generateUnitTags: opts.produceBatch.generateUnitTags,
      createdBy: opts.createdBy,
      tx: opts.tx,
    });
  }

  return pickBatchFefo(opts.tenantId, opts.productId, qty, opts.tx, null);
}
