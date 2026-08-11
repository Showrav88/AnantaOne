import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../db.js";

type TxClient = Prisma.TransactionClient;

/** Product stock = sum of active batch qtyRemaining (single source of truth). */
export async function reconcileProductStockQty(
  tenantId: string,
  productId: string,
  tx: TxClient = prisma,
  updatedBy?: string | null,
) {
  const agg = await tx.productionBatch.aggregate({
    where: {
      tenantId,
      productId,
      isActive: true,
      reversedAt: null,
    },
    _sum: { qtyRemaining: true },
  });
  const stockQty = Number(agg._sum.qtyRemaining ?? 0);
  await tx.product.update({
    where: { id: productId },
    data: {
      stockQty,
      ...(updatedBy != null ? { updatedBy } : {}),
    },
  });
  return stockQty;
}

export async function reconcileAllProductStock(
  tenantId: string,
  tx: TxClient = prisma,
) {
  const products = await tx.product.findMany({
    where: { tenantId, isActive: true },
    select: { id: true },
  });
  for (const product of products) {
    await reconcileProductStockQty(tenantId, product.id, tx);
  }
}
