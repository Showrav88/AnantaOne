import { prisma } from "../db.js";

const SOLD_STATUS_CODES = [
  "CONFIRMED",
  "ACCEPTED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
] as const;

export type ProductProductionStat = {
  productId: string;
  qtyBuilt: number;
  qtySold: number;
  qtyInStock: number;
};

/** Per-SKU built (all batches), sold (confirmed orders), in stock (batch remaining). */
export async function getProductProductionStats(
  tenantId: string,
): Promise<ProductProductionStat[]> {
  const products = await prisma.product.findMany({
    where: { tenantId, isActive: true },
    select: { id: true },
  });
  if (!products.length) return [];

  const productIds = products.map((p) => p.id);

  const [builtRows, soldRows, stockRows] = await Promise.all([
    prisma.productionBatch.groupBy({
      by: ["productId"],
      where: { tenantId, productId: { in: productIds } },
      _sum: { qtyProduced: true },
    }),
    prisma.orderLine.groupBy({
      by: ["productId"],
      where: {
        productId: { in: productIds },
        order: {
          tenantId,
          reversedAt: null,
          status: { code: { in: [...SOLD_STATUS_CODES] } },
        },
      },
      _sum: { qty: true },
    }),
    prisma.productionBatch.groupBy({
      by: ["productId"],
      where: {
        tenantId,
        productId: { in: productIds },
        isActive: true,
        reversedAt: null,
      },
      _sum: { qtyRemaining: true },
    }),
  ]);

  const builtMap = new Map(
    builtRows.map((r) => [r.productId, Number(r._sum.qtyProduced ?? 0)]),
  );
  const soldMap = new Map(
    soldRows.map((r) => [r.productId, Number(r._sum.qty ?? 0)]),
  );
  const stockMap = new Map(
    stockRows.map((r) => [r.productId, Number(r._sum.qtyRemaining ?? 0)]),
  );

  return productIds.map((productId) => ({
    productId,
    qtyBuilt: builtMap.get(productId) ?? 0,
    qtySold: soldMap.get(productId) ?? 0,
    qtyInStock: stockMap.get(productId) ?? 0,
  }));
}
