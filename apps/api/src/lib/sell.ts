import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../db.js";
import { recordWalletTxn, serializeTxn } from "./wallet.js";

type TxClient = Prisma.TransactionClient;

export function serializeBatch(batch: {
  id: string;
  tenantId: string;
  productId: string;
  batchCode: string;
  manufacturedAt: Date;
  expiresAt: Date | null;
  qtyProduced: { toString(): string } | number | string;
  qtyRemaining: { toString(): string } | number | string;
  note: string | null;
  isActive: boolean;
  product?: {
    id: string;
    name: string;
    nameBn: string | null;
    sku: string;
    priceBdt: { toString(): string } | number | string;
    description: string | null;
  };
}) {
  return {
    id: batch.id,
    tenantId: batch.tenantId,
    productId: batch.productId,
    batchCode: batch.batchCode,
    manufacturedAt: batch.manufacturedAt,
    expiresAt: batch.expiresAt,
    qtyProduced: Number(batch.qtyProduced),
    qtyRemaining: Number(batch.qtyRemaining),
    note: batch.note,
    isActive: batch.isActive,
    product: batch.product
      ? {
          id: batch.product.id,
          name: batch.product.name,
          nameBn: batch.product.nameBn,
          sku: batch.product.sku,
          priceBdt: Number(batch.product.priceBdt),
          description: batch.product.description,
        }
      : null,
  };
}

export function serializeOrder(order: {
  id: string;
  tenantId: string;
  buyerId: string | null;
  buyerName: string | null;
  totalBdt: { toString(): string } | number | string;
  note: string | null;
  orderedAt: Date;
  confirmedAt: Date | null;
  saleId: string | null;
  source?: { code: string; nameEn: string; nameBn: string };
  status?: { code: string; nameEn: string; nameBn: string };
  buyer?: { id: string; shopName: string; phone: string } | null;
  lines?: Array<{
    id: string;
    productId: string;
    batchId: string;
    qty: { toString(): string } | number | string;
    unitPriceBdt: { toString(): string } | number | string;
    lineTotalBdt: { toString(): string } | number | string;
    product?: {
      name: string;
      nameBn: string | null;
      sku: string;
      description: string | null;
    };
    batch?: {
      batchCode: string;
      manufacturedAt: Date;
      expiresAt: Date | null;
    };
  }>;
}) {
  return {
    id: order.id,
    tenantId: order.tenantId,
    buyerId: order.buyerId,
    buyerName: order.buyerName,
    totalBdt: Number(order.totalBdt),
    note: order.note,
    orderedAt: order.orderedAt,
    confirmedAt: order.confirmedAt,
    saleId: order.saleId,
    source: order.source
      ? {
          code: order.source.code,
          nameEn: order.source.nameEn,
          nameBn: order.source.nameBn,
        }
      : null,
    status: order.status
      ? {
          code: order.status.code,
          nameEn: order.status.nameEn,
          nameBn: order.status.nameBn,
        }
      : null,
    buyer: order.buyer
      ? {
          id: order.buyer.id,
          shopName: order.buyer.shopName,
          phone: order.buyer.phone,
        }
      : null,
    lines: (order.lines ?? []).map((line) => ({
      id: line.id,
      productId: line.productId,
      batchId: line.batchId,
      qty: Number(line.qty),
      unitPriceBdt: Number(line.unitPriceBdt),
      lineTotalBdt: Number(line.lineTotalBdt),
      product: line.product
        ? {
            name: line.product.name,
            nameBn: line.product.nameBn,
            sku: line.product.sku,
            description: line.product.description,
          }
        : null,
      batch: line.batch
        ? {
            batchCode: line.batch.batchCode,
            manufacturedAt: line.batch.manufacturedAt,
            expiresAt: line.batch.expiresAt,
          }
        : null,
    })),
  };
}

/** Pick earliest-expiry batch with enough remaining qty (FEFO). */
export async function pickBatchFefo(
  tenantId: string,
  productId: string,
  qty: number,
  tx: TxClient = prisma,
  preferredBatchId?: string | null,
) {
  if (preferredBatchId) {
    const preferred = await tx.productionBatch.findFirst({
      where: {
        id: preferredBatchId,
        tenantId,
        productId,
        isActive: true,
      },
    });
    if (!preferred || Number(preferred.qtyRemaining) < qty) {
      throw new Error("Selected batch has insufficient quantity");
    }
    return preferred;
  }

  const batches = await tx.productionBatch.findMany({
    where: {
      tenantId,
      productId,
      isActive: true,
      qtyRemaining: { gt: 0 },
    },
    orderBy: [{ expiresAt: "asc" }, { manufacturedAt: "asc" }],
  });

  const fit = batches.find((b) => Number(b.qtyRemaining) >= qty);
  if (!fit) {
    throw new Error("No production batch with enough stock for this product");
  }
  return fit;
}

export type ConfirmLineInput = {
  productId: string;
  qty: number;
  unitPriceBdt?: number;
  batchId?: string | null;
};

export type ConfirmSellInput = {
  tenantId: string;
  userId: string;
  sourceCode: string;
  buyerId?: string | null;
  buyerName?: string | null;
  note?: string | null;
  lines: ConfirmLineInput[];
  creditWallet?: boolean;
};

/**
 * Counter / phone / online confirm:
 * allocate batches → drop stock → create order → credit cash drawer.
 */
export async function confirmSell(input: ConfirmSellInput) {
  if (!input.lines.length) {
    throw new Error("At least one product line is required");
  }

  const source = await prisma.orderSourceLookup.findUnique({
    where: { code: input.sourceCode },
  });
  const statusConfirmed = await prisma.orderStatusLookup.findUnique({
    where: { code: "CONFIRMED" },
  });
  if (!source || !statusConfirmed) {
    throw new Error("Order lookups missing — run migrations");
  }

  let buyerName = input.buyerName ?? null;
  if (input.buyerId) {
    const buyer = await prisma.buyer.findFirst({
      where: { id: input.buyerId, tenantId: input.tenantId, isActive: true },
    });
    if (!buyer) throw new Error("Buyer shop not found");
    buyerName = buyer.shopName;
  }

  const order = await prisma.$transaction(async (tx) => {
    const prepared: Array<{
      productId: string;
      batchId: string;
      qty: number;
      unitPriceBdt: number;
      lineTotalBdt: number;
    }> = [];

    for (const line of input.lines) {
      if (!(line.qty > 0)) throw new Error("Line qty must be positive");
      const product = await tx.product.findFirst({
        where: {
          id: line.productId,
          tenantId: input.tenantId,
          isActive: true,
        },
      });
      if (!product) throw new Error("Product not found");

      const batch = await pickBatchFefo(
        input.tenantId,
        product.id,
        line.qty,
        tx,
        line.batchId,
      );

      const unitPrice =
        line.unitPriceBdt != null
          ? line.unitPriceBdt
          : Number(product.priceBdt);

      await tx.productionBatch.update({
        where: { id: batch.id },
        data: { qtyRemaining: Number(batch.qtyRemaining) - line.qty },
      });
      await tx.product.update({
        where: { id: product.id },
        data: {
          stockQty: Math.max(0, Number(product.stockQty) - line.qty),
          updatedBy: input.userId,
        },
      });

      prepared.push({
        productId: product.id,
        batchId: batch.id,
        qty: line.qty,
        unitPriceBdt: unitPrice,
        lineTotalBdt: unitPrice * line.qty,
      });
    }

    const totalBdt = prepared.reduce((s, l) => s + l.lineTotalBdt, 0);

    return tx.salesOrder.create({
      data: {
        tenantId: input.tenantId,
        buyerId: input.buyerId ?? null,
        buyerName,
        sourceId: source.id,
        statusId: statusConfirmed.id,
        totalBdt,
        note: input.note ?? null,
        confirmedAt: new Date(),
        createdBy: input.userId,
        lines: {
          create: prepared.map((l) => ({
            productId: l.productId,
            batchId: l.batchId,
            qty: l.qty,
            unitPriceBdt: l.unitPriceBdt,
            lineTotalBdt: l.lineTotalBdt,
          })),
        },
      },
      include: {
        source: true,
        status: true,
        buyer: true,
        lines: { include: { product: true, batch: true } },
      },
    });
  });

  const totalBdt = Number(order.totalBdt);
  let sale = null;
  let wallet = null;
  let transaction = null;

  if (input.creditWallet !== false && totalBdt > 0) {
    const walletResult = await recordWalletTxn({
      tenantId: input.tenantId,
      typeCode: "SALE",
      amountBdt: totalBdt,
      note: `Order ${order.id.slice(-6)} — ${buyerName ?? "counter"}`,
      reference: order.id,
      createdBy: input.userId,
    });
    sale = await prisma.sale.create({
      data: {
        tenantId: input.tenantId,
        buyerId: input.buyerId ?? null,
        buyerName,
        amountBdt: totalBdt,
        note: input.note ?? `Sales order ${order.id}`,
        cashTransactionId: walletResult.transaction.id,
        createdBy: input.userId,
      },
    });
    await prisma.salesOrder.update({
      where: { id: order.id },
      data: { saleId: sale.id },
    });
    wallet = {
      id: walletResult.wallet.id,
      balanceBdt: Number(walletResult.wallet.balanceBdt),
    };
    transaction = serializeTxn(walletResult.transaction);
  }

  const full = await prisma.salesOrder.findUniqueOrThrow({
    where: { id: order.id },
    include: {
      source: true,
      status: true,
      buyer: true,
      lines: { include: { product: true, batch: true } },
    },
  });

  return {
    order: serializeOrder(full),
    sale: sale
      ? {
          id: sale.id,
          amountBdt: Number(sale.amountBdt),
          soldAt: sale.soldAt,
        }
      : null,
    wallet,
    transaction,
  };
}

export function buildTagPayload(opts: {
  company: {
    name: string;
    slug: string;
    phone: string | null;
  };
  product: {
    name: string;
    nameBn: string | null;
    sku: string;
    priceBdt: number;
    description: string | null;
  };
  batch: {
    batchCode: string;
    manufacturedAt: Date;
    expiresAt: Date | null;
  };
  template: {
    widthMm: number;
    heightMm: number;
    showSku: boolean;
    showPrice: boolean;
    showDescription: boolean;
    showMfgDate: boolean;
    showExpDate: boolean;
    showBatch: boolean;
    showQr: boolean;
    showCompany: boolean;
    tagDescription: string | null;
  };
  publicBaseUrl: string;
}) {
  const qrValue = `${opts.publicBaseUrl.replace(/\/$/, "")}/#/tag/${opts.company.slug}/${encodeURIComponent(opts.product.sku)}/${encodeURIComponent(opts.batch.batchCode)}`;
  const description =
    opts.template.tagDescription?.trim() ||
    opts.product.description ||
    opts.product.nameBn ||
    opts.product.name;

  return {
    size: {
      widthMm: opts.template.widthMm,
      heightMm: opts.template.heightMm,
    },
    fields: {
      company: opts.template.showCompany ? opts.company.name : null,
      phone: opts.template.showCompany ? opts.company.phone : null,
      productName: opts.product.nameBn || opts.product.name,
      sku: opts.template.showSku ? opts.product.sku : null,
      priceBdt: opts.template.showPrice ? opts.product.priceBdt : null,
      description: opts.template.showDescription ? description : null,
      batchCode: opts.template.showBatch ? opts.batch.batchCode : null,
      manufacturedAt: opts.template.showMfgDate
        ? opts.batch.manufacturedAt
        : null,
      expiresAt: opts.template.showExpDate ? opts.batch.expiresAt : null,
      qrValue: opts.template.showQr ? qrValue : null,
    },
  };
}
