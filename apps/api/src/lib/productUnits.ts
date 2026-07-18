import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../db.js";
import { makeShortSerialCode } from "./shortCodes.js";

type TxClient = Prisma.TransactionClient;

/** Short unique unit code (SKU + base36 serial, ≥1B capacity). */
export function makeSerialCode(opts: {
  sku: string;
  batchCode: string;
  serialNo: number;
}) {
  void opts.batchCode; // batch stays on the tag print fields, not in the QR code
  return makeShortSerialCode(opts.sku, opts.serialNo);
}

/**
 * QR payload for a unit tag — short code only (not a URL).
 * Example: MW001000001
 */
export function buildUnitQrPayload(opts: { serialCode: string }) {
  return opts.serialCode;
}

/** @deprecated Use buildUnitQrPayload — tags encode short codes, not URLs. */
export function buildUnitQrUrl(opts: {
  publicBaseUrl?: string;
  companySlug?: string;
  serialCode: string;
}) {
  void opts.publicBaseUrl;
  void opts.companySlug;
  return buildUnitQrPayload({ serialCode: opts.serialCode });
}

export async function nextSerialStart(
  tenantId: string,
  productId: string,
  tx: TxClient | typeof prisma = prisma,
) {
  const last = await tx.productUnit.findFirst({
    where: { tenantId, productId },
    orderBy: { serialNo: "desc" },
    select: { serialNo: true },
  });
  return (last?.serialNo ?? 0) + 1;
}

/** Create unique IN_STOCK unit rows for a new production batch. */
export async function createBatchUnits(opts: {
  tenantId: string;
  productId: string;
  productSku: string;
  batchId: string;
  batchCode: string;
  qty: number;
  tx: TxClient;
}) {
  const qty = Math.floor(opts.qty);
  if (qty < 1) {
    return { serialStart: null as number | null, serialEnd: null as number | null };
  }

  const serialStart = await nextSerialStart(
    opts.tenantId,
    opts.productId,
    opts.tx,
  );
  const serialEnd = serialStart + qty - 1;
  const rows = [];
  for (let serialNo = serialStart; serialNo <= serialEnd; serialNo += 1) {
    rows.push({
      tenantId: opts.tenantId,
      productId: opts.productId,
      batchId: opts.batchId,
      serialNo,
      serialCode: makeSerialCode({
        sku: opts.productSku,
        batchCode: opts.batchCode,
        serialNo,
      }),
      status: "IN_STOCK",
    });
  }

  // Create in chunks to avoid huge payloads
  const chunk = 200;
  for (let i = 0; i < rows.length; i += chunk) {
    await opts.tx.productUnit.createMany({ data: rows.slice(i, i + chunk) });
  }

  return { serialStart, serialEnd };
}

/** Allocate N in-stock units from a batch to an order line (sale). */
export async function allocateUnitsToLine(opts: {
  tenantId: string;
  batchId: string;
  orderLineId: string;
  qty: number;
  tx: TxClient;
}) {
  const qty = Math.floor(opts.qty);
  if (qty < 1) return [];

  const taggedCount = await opts.tx.productUnit.count({
    where: { tenantId: opts.tenantId, batchId: opts.batchId },
  });
  // Legacy batches without individual tags — skip unit allocation.
  if (taggedCount === 0) return [];

  const units = await opts.tx.productUnit.findMany({
    where: {
      tenantId: opts.tenantId,
      batchId: opts.batchId,
      status: "IN_STOCK",
    },
    orderBy: { serialNo: "asc" },
    take: qty,
  });
  if (units.length < qty) {
    throw new Error(
      `Not enough tagged units in batch (need ${qty}, have ${units.length})`,
    );
  }

  const now = new Date();
  await opts.tx.productUnit.updateMany({
    where: { id: { in: units.map((u) => u.id) } },
    data: {
      status: "SOLD",
      orderLineId: opts.orderLineId,
      soldAt: now,
    },
  });
  return units;
}

/** Return sold units to stock when a sale is reversed/cancelled. */
export async function restoreUnitsForOrderLines(opts: {
  tenantId: string;
  orderLineIds: string[];
  tx: TxClient;
}) {
  if (!opts.orderLineIds.length) return 0;
  const result = await opts.tx.productUnit.updateMany({
    where: {
      tenantId: opts.tenantId,
      orderLineId: { in: opts.orderLineIds },
      status: "SOLD",
    },
    data: {
      status: "IN_STOCK",
      orderLineId: null,
      soldAt: null,
    },
  });
  return result.count;
}

/** Void unused units when reversing a production batch. */
export async function voidUnusedBatchUnits(opts: {
  tenantId: string;
  batchId: string;
  tx: TxClient;
}) {
  const sold = await opts.tx.productUnit.count({
    where: {
      tenantId: opts.tenantId,
      batchId: opts.batchId,
      status: "SOLD",
    },
  });
  if (sold > 0) {
    throw new Error(
      `${sold} unit(s) already sold from this batch — reverse those sales first`,
    );
  }
  const result = await opts.tx.productUnit.updateMany({
    where: {
      tenantId: opts.tenantId,
      batchId: opts.batchId,
      status: "IN_STOCK",
    },
    data: { status: "VOID" },
  });
  return result.count;
}

export function serializeProductUnit(unit: {
  id: string;
  serialNo: number;
  serialCode: string;
  status: string;
  soldAt: Date | null;
  batchId: string;
  productId: string;
  product?: {
    name: string;
    nameBn: string | null;
    sku: string;
    size?: { toString(): string } | number | string | null;
    priceBdt?: { toString(): string } | number | string;
    unit?: { code: string; nameEn: string; nameBn: string } | null;
  } | null;
  batch?: {
    batchCode: string;
    manufacturedAt: Date;
    expiresAt: Date | null;
    serialStart: number | null;
    serialEnd: number | null;
  } | null;
}) {
  return {
    id: unit.id,
    serialNo: unit.serialNo,
    serialCode: unit.serialCode,
    status: unit.status,
    soldAt: unit.soldAt,
    batchId: unit.batchId,
    productId: unit.productId,
    product: unit.product
      ? {
          name: unit.product.name,
          nameBn: unit.product.nameBn,
          sku: unit.product.sku,
          size:
            unit.product.size == null ? null : Number(unit.product.size),
          priceBdt:
            unit.product.priceBdt == null
              ? null
              : Number(unit.product.priceBdt),
          unit: unit.product.unit?.code ?? null,
          unitLabel: unit.product.unit
            ? {
                en: unit.product.unit.nameEn,
                bn: unit.product.unit.nameBn,
              }
            : null,
        }
      : null,
    batch: unit.batch
      ? {
          batchCode: unit.batch.batchCode,
          manufacturedAt: unit.batch.manufacturedAt,
          expiresAt: unit.batch.expiresAt,
          serialStart: unit.batch.serialStart,
          serialEnd: unit.batch.serialEnd,
        }
      : null,
  };
}
