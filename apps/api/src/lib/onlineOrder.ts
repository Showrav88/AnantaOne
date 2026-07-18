import { prisma } from "../db.js";
import { quoteOrderTotals, normalizeCategory } from "./delivery.js";
import {
  makeInvoiceCode,
  pickBatchFefo,
  serializeOrder,
} from "./sell.js";
import { recordWalletTxn } from "./wallet.js";

export type OnlineCheckoutLine = {
  productId: string;
  qty: number;
};

export type OnlineCheckoutInput = {
  tenantId: string;
  branchId?: string | null;
  shopName: string;
  clientName: string;
  phone: string;
  address: string;
  wardId: string;
  couponCode?: string | null;
  note?: string | null;
  lines: OnlineCheckoutLine[];
};

export async function placeOnlineOrder(input: OnlineCheckoutInput) {
  if (!input.lines.length) throw new Error("Cart is empty");

  const products = await prisma.product.findMany({
    where: {
      tenantId: input.tenantId,
      id: { in: input.lines.map((l) => l.productId) },
      isActive: true,
    },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const quoteLines = input.lines.map((line) => {
    const product = productMap.get(line.productId);
    if (!product) throw new Error("Product not found");
    if (Number(product.stockQty) < line.qty) {
      throw new Error(`Insufficient stock for ${product.name}`);
    }
    return {
      productId: product.id,
      category: product.category,
      qty: line.qty,
      unitPriceBdt: Number(product.priceBdt),
    };
  });

  const quote = await quoteOrderTotals(input.tenantId, {
    lines: quoteLines,
    wardId: input.wardId,
    branchId: input.branchId,
    couponCode: input.couponCode,
  });

  const source = await prisma.orderSourceLookup.findUniqueOrThrow({
    where: { code: "ONLINE" },
  });
  const status = await prisma.orderStatusLookup.findUniqueOrThrow({
    where: { code: "PENDING" },
  });

  const phone = input.phone.trim();
  let buyer = await prisma.buyer.findUnique({
    where: {
      tenantId_phone: { tenantId: input.tenantId, phone },
    },
  });
  if (!buyer) {
    buyer = await prisma.buyer.create({
      data: {
        tenantId: input.tenantId,
        shopName: input.shopName.trim(),
        contactName: input.clientName.trim(),
        phone,
        address: input.address.trim(),
        wardId: input.wardId,
      },
    });
  } else {
    buyer = await prisma.buyer.update({
      where: { id: buyer.id },
      data: {
        shopName: input.shopName.trim(),
        contactName: input.clientName.trim(),
        address: input.address.trim(),
        wardId: input.wardId,
        isActive: true,
      },
    });
  }

  const order = await prisma.$transaction(async (tx) => {
    if (quote.coupon) {
      await tx.coupon.update({
        where: { id: quote.coupon.id },
        data: { usedCount: { increment: 1 } },
      });
    }

    const created = await tx.salesOrder.create({
      data: {
        tenantId: input.tenantId,
        branchId: input.branchId ?? null,
        invoiceCode: "TMP",
        buyerId: buyer!.id,
        buyerName: input.shopName.trim(),
        clientName: input.clientName.trim(),
        shopName: input.shopName.trim(),
        phone,
        address: input.address.trim(),
        wardId: input.wardId,
        couponId: quote.coupon?.id ?? null,
        couponCode: quote.coupon?.code ?? null,
        subtotalBdt: quote.subtotalBdt,
        deliveryBdt: quote.deliveryBdt,
        discountBdt: quote.discountBdt,
        totalBdt: quote.totalBdt,
        note: input.note ?? null,
        sourceId: source.id,
        statusId: status.id,
        lines: {
          create: quoteLines.map((l) => ({
            productId: l.productId,
            batchId: null,
            qty: l.qty,
            catalogPriceBdt: l.unitPriceBdt,
            unitPriceBdt: l.unitPriceBdt,
            lineTotalBdt: l.qty * l.unitPriceBdt,
          })),
        },
      },
      include: {
        source: true,
        status: true,
        buyer: true,
        ward: true,
        lines: { include: { product: true, batch: true } },
      },
    });

    const invoiceCode = makeInvoiceCode(created.orderedAt, created.id);
    return tx.salesOrder.update({
      where: { id: created.id },
      data: { invoiceCode },
      include: {
        source: true,
        status: true,
        buyer: true,
        ward: true,
        coupon: true,
        lines: { include: { product: true, batch: true } },
      },
    });
  });

  return { order, quote };
}

/** Accept pending online order: allocate FEFO batches, confirm, credit wallet. */
export async function acceptOnlineOrder(opts: {
  tenantId: string;
  orderId: string;
  userId: string;
  creditWallet?: boolean;
}) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.salesOrder.findFirst({
      where: { id: opts.orderId, tenantId: opts.tenantId },
      include: {
        status: true,
        source: true,
        lines: { include: { product: true } },
      },
    });
    if (!order) throw new Error("Order not found");
    if (order.status.code !== "PENDING") {
      throw new Error("Only pending online orders can be accepted");
    }

    const accepted = await tx.orderStatusLookup.findUniqueOrThrow({
      where: { code: "ACCEPTED" },
    });

    for (const line of order.lines) {
      const batch = await pickBatchFefo(
        opts.tenantId,
        line.productId,
        Number(line.qty),
        tx,
      );
      await tx.productionBatch.update({
        where: { id: batch.id },
        data: { qtyRemaining: { decrement: Number(line.qty) } },
      });
      await tx.product.update({
        where: { id: line.productId },
        data: { stockQty: { decrement: Number(line.qty) } },
      });
      await tx.orderLine.update({
        where: { id: line.id },
        data: { batchId: batch.id },
      });
    }

    let saleId: string | null = null;
    if (opts.creditWallet !== false && Number(order.totalBdt) > 0) {
      const { transaction } = await recordWalletTxn({
        tenantId: opts.tenantId,
        typeCode: "SALE",
        amountBdt: Number(order.totalBdt),
        note: `Online order ${order.invoiceCode}`,
        createdBy: opts.userId,
        tx,
      });
      const sale = await tx.sale.create({
        data: {
          tenantId: opts.tenantId,
          buyerId: order.buyerId,
          buyerName: order.buyerName ?? order.shopName,
          amountBdt: Number(order.totalBdt),
          cashTransactionId: transaction.id,
          soldAt: new Date(),
          createdBy: opts.userId,
        },
      });
      saleId = sale.id;
    }

    const updated = await tx.salesOrder.update({
      where: { id: order.id },
      data: {
        statusId: accepted.id,
        confirmedAt: new Date(),
        saleId,
        updatedBy: opts.userId,
      },
      include: {
        source: true,
        status: true,
        buyer: true,
        ward: true,
        coupon: true,
        lines: { include: { product: true, batch: true } },
      },
    });

    return serializeOnlineOrder(updated);
  });
}

export async function setOnlineOrderStatus(opts: {
  tenantId: string;
  orderId: string;
  userId: string;
  statusCode: "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";
}) {
  const order = await prisma.salesOrder.findFirst({
    where: { id: opts.orderId, tenantId: opts.tenantId },
    include: { status: true, source: true },
  });
  if (!order) throw new Error("Order not found");
  if (order.source.code !== "ONLINE") {
    throw new Error("Not an online order");
  }

  const status = await prisma.orderStatusLookup.findUniqueOrThrow({
    where: { code: opts.statusCode },
  });

  // Cancel pending without stock impact; cancel accepted needs reverse path elsewhere
  if (opts.statusCode === "CANCELLED" && order.status.code === "PENDING") {
    if (order.couponId) {
      await prisma.coupon.update({
        where: { id: order.couponId },
        data: { usedCount: { decrement: 1 } },
      });
    }
  } else if (opts.statusCode === "CANCELLED") {
    throw new Error("Cancel accepted orders via sale reverse");
  }

  const updated = await prisma.salesOrder.update({
    where: { id: order.id },
    data: { statusId: status.id, updatedBy: opts.userId },
    include: {
      source: true,
      status: true,
      buyer: true,
      ward: true,
      coupon: true,
      lines: { include: { product: true, batch: true } },
    },
  });
  return serializeOnlineOrder(updated);
}

export function serializeOnlineOrder(order: {
  id: string;
  tenantId: string;
  invoiceCode: string;
  buyerId: string | null;
  buyerName: string | null;
  clientName: string | null;
  shopName: string | null;
  phone: string | null;
  address: string | null;
  wardId: string | null;
  couponCode: string | null;
  subtotalBdt: { toString(): string } | number;
  deliveryBdt: { toString(): string } | number;
  discountBdt: { toString(): string } | number;
  totalBdt: { toString(): string } | number;
  note: string | null;
  orderedAt: Date;
  confirmedAt: Date | null;
  saleId: string | null;
  source?: { code: string; nameEn: string; nameBn: string };
  status?: { code: string; nameEn: string; nameBn: string };
  buyer?: { id: string; shopName: string; phone: string; contactName?: string | null } | null;
  ward?: { id: string; name: string; nameBn: string | null; freeDelivery: boolean } | null;
  coupon?: { id: string; code: string; discountType: string; discountValue: { toString(): string } | number } | null;
  lines?: Array<{
    id: string;
    productId: string;
    batchId: string | null;
    qty: { toString(): string } | number;
    catalogPriceBdt: { toString(): string } | number;
    unitPriceBdt: { toString(): string } | number;
    lineTotalBdt: { toString(): string } | number;
    product?: {
      name: string;
      nameBn: string | null;
      sku: string;
      category?: string;
      description: string | null;
      imageUrl?: string | null;
    };
    batch?: {
      batchCode: string;
      manufacturedAt: Date;
      expiresAt: Date | null;
    } | null;
  }>;
}) {
  const base = serializeOrder({
    ...order,
    lines: order.lines,
  });
  return {
    ...base,
    clientName: order.clientName,
    shopName: order.shopName,
    phone: order.phone,
    address: order.address,
    wardId: order.wardId,
    couponCode: order.couponCode,
    subtotalBdt: Number(order.subtotalBdt),
    deliveryBdt: Number(order.deliveryBdt),
    discountBdt: Number(order.discountBdt),
    ward: order.ward
      ? {
          id: order.ward.id,
          name: order.ward.name,
          nameBn: order.ward.nameBn,
          freeDelivery: order.ward.freeDelivery,
        }
      : null,
    coupon: order.coupon
      ? {
          id: order.coupon.id,
          code: order.coupon.code,
          discountType: order.coupon.discountType,
          discountValue: Number(order.coupon.discountValue),
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
            category: normalizeCategory(line.product.category),
            description: line.product.description,
            imageUrl: line.product.imageUrl ?? null,
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
